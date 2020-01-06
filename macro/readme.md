# babel-plugin-macros

> [项目地址](https://github.com/kentcdodds/babel-plugin-macros)

> 整体实现挺简单的，主要是这个思路还是很酷毙的！

```js
const p = require('path')
const resolve = require('resolve')
// const printAST = require('ast-pretty-print')

// 写 macro 的时候命名有规矩的
const macrosRegex = /[./]macro(\.js)?$/
const testMacrosRegex = v => macrosRegex.test(v)

// 👉 https://stackoverflow.com/a/32749533/971592
class MacroError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MacroError'
    /* istanbul ignore else */
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else if (!this.stack) {
      this.stack = new Error(message).stack
    }
  }
}

// cosmiconfig 👈 就是这个库
let _configExplorer = null
function getConfigExporer() {
  return (_configExplorer =
    _configExplorer ||
    // Lazy load cosmiconfig since it is a relatively large bundle
    require('cosmiconfig').cosmiconfigSync('babel-plugin-macros', {
      searchPlaces: [
        'package.json',
        '.babel-plugin-macrosrc',
        '.babel-plugin-macrosrc.json',
        '.babel-plugin-macrosrc.yaml',
        '.babel-plugin-macrosrc.yml',
        '.babel-plugin-macrosrc.js',
        'babel-plugin-macros.config.js',
      ],
      packageProp: 'babelMacros',
    }))
}

// 返回的就是这个工厂函数，用来定义 macro
function createMacro(macro, options = {}) {
  if (options.configName === 'options') {
    throw new Error(
      `You cannot use the configName "options". It is reserved for babel-plugin-macros.`,
    )
  }
  macroWrapper.isBabelMacro = true
  macroWrapper.options = options
  return macroWrapper

  function macroWrapper(args) {
    const {source, isBabelMacrosCall} = args
    if (!isBabelMacrosCall) {
      throw new MacroError(
        `The macro you imported from "${source}" is being executed outside the context of compilation with babel-plugin-macros. ` +
          `This indicates that you don't have the babel plugin "babel-plugin-macros" configured correctly. ` +
          `Please see the documentation for how to configure babel-plugin-macros properly: ` +
          'https://github.com/kentcdodds/babel-plugin-macros/blob/master/other/docs/user.md',
      )
    }
    return macro(args)
  }
}

// 用了 resolve 这个库，下边那个 pr 也有点意思
function nodeResolvePath(source, basedir) {
  return resolve.sync(source, {
    basedir,
    // This is here to support the package being globally installed
    // read more: https://github.com/kentcdodds/babel-plugin-macros/pull/138
    paths: [p.resolve(__dirname, '../../')]
  })
}

// babel 插件
function macrosPlugin(
  babel,
  {
    require: _require = require,
    resolvePath = nodeResolvePath,
    isMacrosName = testMacrosRegex,
    ...options
  } = {},
) {
  // 熟悉 webpack 的应该知道这里的目的
  function interopRequire(path) {
    // eslint-disable-next-line import/no-dynamic-require
    const o = _require(path)
    return o && o.__esModule && o.default ? o.default : o
  }

  // handle book:
  // https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md#toc-visitors
  return {
    name: 'macros',
    visitor: {
      Program(progPath, state) {
        // tranverse 一下，找两种引入模块的节点
        // import xx from 'xx' 以及 const xx = require('xxx')
        progPath.traverse({
          ImportDeclaration(path) {
            // 结合 ast.explorer，一下就明白了
            const isMacros = looksLike(path, {
              node: {
                source: {
                  value: v => isMacrosName(v),
                },
              },
            })
            if (!isMacros) {
              return
            }
            const imports = path.node.specifiers.map(s => ({
              localName: s.local.name,
              // import xx 和 import {xx}
              importedName:
                s.type === 'ImportDefaultSpecifier'
                  ? 'default'
                  : s.imported.name,
            }))
            // from 'source'
            const source = path.node.source.value
            const result = applyMacros({
              path,
              imports,
              source,
              state,
              babel,
              interopRequire,
              resolvePath,
              options,
            })
            // https://github.com/kentcdodds/babel-plugin-macros/blob/master/other/docs/author.md#keeping-imports
            if (!result || !result.keepImports) {
              path.remove()
            }
          },
          VariableDeclaration(path) {
            const isMacros = child =>
              looksLike(child, {
                node: {
                  init: {
                    callee: {
                      type: 'Identifier',
                      name: 'require',
                    },
                    arguments: args =>
                      args.length === 1 && isMacrosName(args[0].value),
                  },
                },
              })

            path
              .get('declarations')
              .filter(isMacros)
              .forEach(child => {
                const imports = child.node.id.name
                  ? [{localName: child.node.id.name, importedName: 'default'}]
                  : child.node.id.properties.map(property => ({
                      localName: property.value.name,
                      importedName: property.key.name,
                    }))

                // 因为可以到处使用 require('xxx').xx
                const call = child.get('init')
                const source = call.node.arguments[0].value
                const result = applyMacros({
                  path: call,
                  imports,
                  source,
                  state,
                  babel,
                  interopRequire,
                  resolvePath,
                  options,
                })

                if (!result || !result.keepImports) {
                  child.remove()
                }
              })
          },
        })
      },
    },
  }
}

// eslint-disable-next-line complexity
function applyMacros({
  path,
  imports,
  source,
  state,
  babel,
  interopRequire,
  resolvePath,
  options,
}) {
  /* istanbul ignore next (pretty much only useful for astexplorer I think) */
  // 取文件名
  const {
    file: {
      opts: {filename = ''},
    },
  } = state
  let hasReferences = false // 这个锁也是为了减少计算，只要有一处引用就完事儿了
  const referencePathsByImportName = imports.reduce(
    (byName, {importedName, localName}) => {
      const binding = path.scope.getBinding(localName)

      byName[importedName] = binding.referencePaths
      hasReferences = hasReferences || Boolean(byName[importedName].length)

      return byName
    },
    {},
  )

  const isRelative = source.indexOf('.') === 0
  const requirePath = resolvePath(source, p.dirname(getFullFilename(filename)))

  const macro = interopRequire(requirePath)
  // 通过在工厂返回的函数上加了个 flag 进行判断
  if (!macro.isBabelMacro) { 
    throw new Error(
      `The macro imported from "${source}" must be wrapped in "createMacro" ` +
        `which you can get from "babel-plugin-macros". ` +
        `Please refer to the documentation to see how to do this properly: https://github.com/kentcdodds/babel-plugin-macros/blob/master/other/docs/author.md#writing-a-macro`,
    )
  }
  const config = getConfig(macro, filename, source, options)

  let result
  try {
    /**
     * Other plugins that run before babel-plugin-macros might use path.replace, where a path is
     * put into its own replacement. Apparently babel does not update the scope after such
     * an operation. As a remedy, the whole scope is traversed again with an empty "Identifier"
     * visitor - this makes the problem go away.
     *
     * See: https://github.com/kentcdodds/import-all.macro/issues/7
     */
     // 这个 hack 是为了还原 scope
    state.file.scope.path.traverse({
      Identifier() {},
    })

    result = macro({
      references: referencePathsByImportName,
      source,
      state,
      babel,
      config,
      isBabelMacrosCall: true,
    })
  } catch (error) {
    if (error.name === 'MacroError') {
      throw error
    }
    error.message = `${source}: ${error.message}`
    if (!isRelative) {
      error.message = `${
        error.message
      } Learn more: https://www.npmjs.com/package/${source.replace(
        // remove everything after package name
        // @org/package/macro -> @org/package
        // package/macro      -> package
        /^((?:@[^/]+\/)?[^/]+).*/,
        '$1',
      )}`
    }
    throw error
  }
  return result
}

function getConfigFromFile(configName, filename) {
  try {
    const loaded = getConfigExporer().search(filename)

    if (loaded) {
      return {
        options: loaded.config[configName],
        path: loaded.filepath,
      }
    }
  } catch (e) {
    return {error: e}
  }
  return {}
}

function getConfigFromOptions(configName, options) {
  if (options.hasOwnProperty(configName)) {
    if (options[configName] && typeof options[configName] !== 'object') {
      // eslint-disable-next-line no-console
      console.error(
        `The macro plugin options' ${configName} property was not an object or null.`,
      )
    } else {
      return {options: options[configName]}
    }
  }
  return {}
}

function getConfig(macro, filename, source, options) {
  // https://github.com/kentcdodds/babel-plugin-macros/blob/master/other/docs/author.md#config
  // 配置都是通过 configName 来取的
  const {configName} = macro.options
  if (configName) {
    const fileConfig = getConfigFromFile(configName, filename)
    const optionsConfig = getConfigFromOptions(configName, options)

    if (
      optionsConfig.options === undefined &&
      fileConfig.options === undefined &&
      fileConfig.error !== undefined
    ) {
      // eslint-disable-next-line no-console
      console.error(
        `There was an error trying to load the config "${configName}" ` +
          `for the macro imported from "${source}. ` +
          `Please see the error thrown for more information.`,
      )
      throw fileConfig.error
    }

    if (
      fileConfig.options !== undefined &&
      optionsConfig.options !== undefined &&
      typeof fileConfig.options !== 'object'
    ) {
      throw new Error(
        `${fileConfig.path} specified a ${configName} config of type ` +
          `${typeof optionsConfig.options}, but the the macros plugin's ` +
          `options.${configName} did contain an object. Both configs must ` +
          `contain objects for their options to be mergeable.`,
      )
    }

    return {
      ...optionsConfig.options,
      ...fileConfig.options,
    }
  }
  return undefined
}

/*
 istanbul ignore next
 because this is hard to test
 and not worth it...
 */
function getFullFilename(filename) {
  if (p.isAbsolute(filename)) {
    return filename
  }
  return p.join(process.cwd(), filename)
}

// 递归 path，通过正则判断是不是合法的 macro 写法
function looksLike(a, b) {
  return (
    a &&
    b &&
    Object.keys(b).every(bKey => {
      const bVal = b[bKey]
      const aVal = a[bKey]
      if (typeof bVal === 'function') {
        return bVal(aVal)
      }
      return isPrimitive(bVal) ? bVal === aVal : looksLike(aVal, bVal)
    })
  )
}

// 这个方法好啊，判断是不是基本类型 null undefined, string number bool symbol, "array object function"
function isPrimitive(val) {
  // eslint-disable-next-line
  return val == null || /^[sbn]/.test(typeof val)
}

module.exports = macrosPlugin
Object.assign(module.exports, {
  createMacro,
  MacroError,
})

```

## think in macro

`macro` 最大的好处是不用配置多次 `babel.config.js`，采用了宏的思想，其实就是可以批量的处理一堆插件，在运行时哦！

理一下实现思路：

`program` -> 寻找所有 `macros` 引用 -> `applyMacros(...{xxx})` -> `macro(...{xxx})`(这个其实就是 macroWrapper)

给人以运行时的感觉，实质上还是将一堆 `plugin` 在 `babel` 转译过程中顺序的执行了。这个顺序完全取决你声明引用的顺序了！

怎么实现不用每次都要在 `babel.config.js` 中配置插件？

-- 该库实现方案就是通过命名空间进行聚合，所有带 `macro` 的库被认为是宏插件，会被 `require`，当然 `require` 进来的就是 `macroWrapper` 方法了。

怎么实现配置的？

-- 两种方式，一种还是配置 `babel options`，一种是 `cosmiconfig` 文件

怎么实现 `macro plugin`？

-- 其实就是 `babel` 转译的时候，进来就找是不是 `macro` 插件，是的话就执行了 `macroWrapper` 函数，这个时候代码中使用到的地方就已经按照预想的替换掉了

```js
import penv from 'penv.macro'

const base = penv({
  'production': 'https://www.baidu.com'
});

// 已经变成了

const base = 'https://www.baidu.com';
```