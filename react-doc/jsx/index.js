/**
 * babel 是如何实现 jsx 支持的
 */

// 写 babel 插件有几个助手：
// 1. https://astexplorer.net/ - 看 AST 树的结构
// 2. https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md - babel handbook
// 3. https://github.com/babel/babel/tree/master/packages/babel-types - babel-types 就是那个 t

// 一个插件的结构很简单：() => {visitor}; 就这样！


// babel-plugin-transform-react-jsx
export default declare((api, options) => {

    // 这里的 declare 是一个工具函数，大致就是 declare = func => { xxx; xxx; return func(); }
    // 上面的 xxx 逻辑，主要加了一些版本的校验
    api.assertVersion(7);

    // 如果存在命名空间，抛出错误不，这个不常用，命名空间一下就联想到的是 xml 了
    const THROW_IF_NAMESPACE = options.throwIfNamespace === undefined ? true : !!options.throwIfNamespace;

    // 这里就看出来了默认是使用 React.createElement 来做替换的，当然你可以在 babel.config.js 中配置
    const PRAGMA_DEFAULT = options.pragma || "React.createElement";
    const PRAGMA_FRAG_DEFAULT = options.pragmaFrag || "React.Fragment";
  
    // 通过文件上的注释也可以配置，但是这种方式不常用
    // 比如：/** @jsx Preact.h */
    const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;
    const JSX_FRAG_ANNOTATION_REGEX = /\*?\s*@jsxFrag\s+([^\s]+)/;

    // 这个工具方法主要是生成 React.createElement 的节点表达，这个你随意写一个 React.createElement 函数在 ast.explorer 看看结构就明白了
    const createIdentifierParser = (id) => () => {
        return id
          .split(".")
          .map(name => t.identifier(name))
          .reduce((object, property) => t.memberExpression(object, property));
    };

    // helper 函数执行后返回一个 visitor 对象
    // 这个 visitor 就是一个映射，存的节点类型及对应的操作，当 walk 到每个节点的时候就从这个映射里面找对应的操作
    // pre post 就是 helper 函数里埋的两个钩子，也很好理解，就是预先执行的和结束时候执行的， helper 函数我在下面会粘出来
    // 所有 t.xx 的都可以从 babel-types 从去找这个函数是干嘛的，我就不一一写了，我也记不住，反正去找就行了，也没啥文档
    const visitor = helper({
        pre(state) {
          // 标签名
          const tagName = state.tagName;
          // props 和 children
          const args = state.args;
          // 必须是合法的标签名字
          if (t.react.isCompatTag(tagName)) {
            args.push(t.stringLiteral(tagName));
          } else {
            args.push(state.tagExpr);
          }
        },
    
        post(state, pass) {
          // pass.get 出来的就是 React.createElement 了
          state.callee = pass.get("jsxIdentifier")();
        },
    
        throwIfNamespace: THROW_IF_NAMESPACE,
    });

    // Program 是顶层的入口，File -> Program ->  Body -> your want!
    visitor.Program = {
        enter(path, state) {
          const { file } = state;
    
          // 下面这一片代码就是要么从配置中读，要么从注释中读
          let pragma = PRAGMA_DEFAULT;
          let pragmaFrag = PRAGMA_FRAG_DEFAULT;
          let pragmaSet = !!options.pragma;
          let pragmaFragSet = !!options.pragmaFrag;
    
          if (file.ast.comments) {
            for (const comment of (file.ast.comments)) {
              const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value);
              if (jsxMatches) {
                pragma = jsxMatches[1];
                pragmaSet = true;
              }
              const jsxFragMatches = JSX_FRAG_ANNOTATION_REGEX.exec(comment.value);
              if (jsxFragMatches) {
                pragmaFrag = jsxFragMatches[1];
                pragmaFragSet = true;
              }
            }
          }
    
          // Program 是 AST 树的顶层，所以是先执行的，这里就往 jsxIdentifier 中绑了处理的 memberExpression：React.createElement;
          state.set("jsxIdentifier", createIdentifierParser(pragma));
          state.set("jsxFragIdentifier", createIdentifierParser(pragmaFrag));
          state.set("usedFragment", false);
          state.set("pragmaSet", pragmaSet);
          state.set("pragmaFragSet", pragmaFragSet);
        },
        exit(path, state) {
          if (
            state.get("pragmaSet") &&
            state.get("usedFragment") &&
            !state.get("pragmaFragSet")
          ) {
            throw new Error(
              "transform-react-jsx: pragma has been set but " +
                "pragmafrag has not been set",
            );
          }
        },
      };
    
      // 属性直接含有一个 JSXElement 的，变为 JSXEXpressionContainer
      // 好比 <Table parent=<a>xxx</a> > -> <Table parent={<a>xxx</a>} >
      visitor.JSXAttribute = function(path) {
        if (t.isJSXElement(path.node.value)) {
          path.node.value = t.jsxExpressionContainer(path.node.value);
        }
      };
    
      return {
        name: "transform-react-jsx",
        inherits: jsx,
        visitor,
      };
});

// packages/babel-helper-builder-react-jsx
// 这个就是上边的 helper 的实现，大概看看上边的代码，知道具体的实现思路，其实很简单
// 1. 通过某种方式拿到最终我们要替换成的函数字符串比如 React.createElement
// 2. 遍历节点，在 JSXElement 的时候，进行处理，这里面要考虑到各种写法，但最主要的还是提取出标签名，属性，children
// 3. 换成 React.creaElement(targName, {props, children}) 这样输出就完事儿了

// type ElementState = {
//   tagExpr: Object, // tag node
//   tagName: ?string, // raw string tag name
//   args: Array<Object>, // array of call arguments
//   call?: Object, // optional call property that can be set to override the call expression returned
// };

export default function(opts) {
  const visitor = {};

  visitor.JSXNamespacedName = function(path) {
    if (opts.throwIfNamespace) {
      throw path.buildCodeFrameError(
        `Namespace tags are not supported by default. React's JSX doesn't support namespace tags. \
You can turn on the 'throwIfNamespace' flag to bypass this warning.`,
      );
    }
  };

  // [...children] 这样就是 SpreadChild 节点了，写 babel 就是要考虑到各种情况，都要 cover 到
  visitor.JSXSpreadChild = function(path) {
    throw path.buildCodeFrameError(
      "Spread children are not supported in React.",
    );
  };

  // 因为babel采用的应该是 DFS 遍历，每个节点自然会走两次，一次 enter，一次 exit
  visitor.JSXElement = {
    exit(path, file) {
      const callExpr = buildElementCall(path, file);
      if (callExpr) {
        path.replaceWith(t.inherits(callExpr, path.node));
      }
    },
  };

  visitor.JSXFragment = {
    exit(path, file) {
      if (opts.compat) {
        throw path.buildCodeFrameError(
          "Fragment tags are only supported in React 16 and up.",
        );
      }
      const callExpr = buildFragmentCall(path, file);
      if (callExpr) {
        path.replaceWith(t.inherits(callExpr, path.node));
      }
    },
  };

  return visitor;

  function convertJSXIdentifier(node, parent) {
    if (t.isJSXIdentifier(node)) { // <Table></Table>
      if (node.name === "this" && t.isReferenced(node, parent)) {
        return t.thisExpression();
      } else if (esutils.keyword.isIdentifierNameES6(node.name)) {
        node.type = "Identifier";
      } else {
        return t.stringLiteral(node.name);
      }
    } else if (t.isJSXMemberExpression(node)) { // <Table.Item></Table.Item>
      return t.memberExpression(
        convertJSXIdentifier(node.object, node),
        convertJSXIdentifier(node.property, node),
      );
    } else if (t.isJSXNamespacedName(node)) {
      /**
       * If there is flag "throwIfNamespace"
       * print XMLNamespace like string literal
       */
      return t.stringLiteral(`${node.namespace.name}:${node.name.name}`);
    }

    return node;
  }

  function convertAttributeValue(node) {
    if (t.isJSXExpressionContainer(node)) {
      return node.expression;
    } else {
      return node;
    }
  }

  function convertAttribute(node) {
    const value = convertAttributeValue(node.value || t.booleanLiteral(true));

    if (t.isStringLiteral(value) && !t.isJSXExpressionContainer(node.value)) {
      value.value = value.value.replace(/\n\s+/g, " ");

      // "raw" JSXText should not be used from a StringLiteral because it needs to be escaped.
      if (value.extra && value.extra.raw) {
        delete value.extra.raw;
      }
    }

    if (t.isJSXNamespacedName(node.name)) {
      node.name = t.stringLiteral(
        node.name.namespace.name + ":" + node.name.name.name,
      );
    } else if (esutils.keyword.isIdentifierNameES6(node.name.name)) {
      node.name.type = "Identifier";
    } else {
      node.name = t.stringLiteral(node.name.name);
    }

    return t.inherits(t.objectProperty(node.name, value), node);
  }

  function buildElementCall(path, file) {
    if (opts.filter && !opts.filter(path.node, file)) return;

    const openingPath = path.get("openingElement");
    // 处理 children
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);

    // tag 是表达式，就是处理不是 hostcomponent 的情况嘛
    const tagExpr = convertJSXIdentifier(
      openingPath.node.name,
      openingPath.node,
    );
    const args = [];

    let tagName;
    if (t.isIdentifier(tagExpr)) {
      tagName = tagExpr.name;
    } else if (t.isLiteral(tagExpr)) {
      tagName = tagExpr.value;
    }

    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
    };

    if (opts.pre) {
      opts.pre(state, file);
    }

    let attribs = openingPath.node.attributes;
    if (attribs.length) {
      attribs = buildOpeningElementAttributes(attribs, file);
    } else {
      attribs = t.nullLiteral();
    }

    args.push(attribs, ...path.node.children);

    if (opts.post) {
      opts.post(state, file);
    }

    // 这里返回的就是 React.createElement(tagName, props)
    return state.call || t.callExpression(state.callee, args);
  }

  function pushProps(_props, objs) {
    if (!_props.length) return _props;

    objs.push(t.objectExpression(_props));
    return [];
  }

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containing
   * all prior attributes to an array for later processing.
   */

  function buildOpeningElementAttributes(attribs, file) {
    let _props = [];
    const objs = [];

    const useBuiltIns = file.opts.useBuiltIns || false;
    if (typeof useBuiltIns !== "boolean") {
      throw new Error(
        "transform-react-jsx currently only accepts a boolean option for " +
          "useBuiltIns (defaults to false)",
      );
    }

    while (attribs.length) {
      const prop = attribs.shift();
      // 拓展剩余语法的话里边本身就是ObjectExpression了
      if (t.isJSXSpreadAttribute(prop)) { // <Table {...props}></Table>
        _props = pushProps(_props, objs);
        objs.push(prop.argument);
      } else {
          // 普通写法的话还是要构造成ObjectExpression
        _props.push(convertAttribute(prop));
      }
    }

    pushProps(_props, objs);

    if (objs.length === 1) {
      // only one object
      attribs = objs[0];
    } else {
      // looks like we have multiple objects
      if (!t.isObjectExpression(objs[0])) {
        objs.unshift(t.objectExpression([]));
      }

      const helper = useBuiltIns
        ? t.memberExpression(t.identifier("Object"), t.identifier("assign"))
        : file.addHelper("extends");

      // spread it
      attribs = t.callExpression(helper, objs);
    }

    return attribs;
  }

  function buildFragmentCall(path, file) {
    if (opts.filter && !opts.filter(path.node, file)) return;

    const openingPath = path.get("openingElement");
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);

    const args = [];
    const tagName = null;
    const tagExpr = file.get("jsxFragIdentifier")();

    // const state: ElementState = {
    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
    };

    if (opts.pre) {
      opts.pre(state, file);
    }

    // no attributes are allowed with <> syntax
    args.push(t.nullLiteral(), ...path.node.children);

    if (opts.post) {
      opts.post(state, file);
    }

    file.set("usedFragment", true);
    return state.call || t.callExpression(state.callee, args);
  }
}
