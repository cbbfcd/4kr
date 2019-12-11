# goober

> [项目地址](https://github.com/cristianbote/goober)

> [作者：cristianbote](https://github.com/cristianbote)

---

# useage

这个参考项目地址的文档即可。

---

# code

## [styled.js](https://github.com/cristianbote/goober/blob/master/src/styled.js)

```js
import { css } from "./css";

let h;
// 对外暴露一个设置 h 函数的方法，只需要在入口调用一次，比如 setPragma(Preact.h), setPragma(React.createElement)
const setPragma = pragma => (h = pragma);

/**
 * Styled function
 * 
 * 使用 styled('div')`display: flex` 得到的是一个组件
 * 
 * @param {String} tag
 */
function styled(tag) {
  // 上下文
  const _ctx = this || {};

  // 模版字符串标记函数 
  // http://es6.ruanyifeng.com/#docs/string#%E6%A8%A1%E6%9D%BF%E5%AD%97%E7%AC%A6%E4%B8%B2
  return function () {
    // 拿到参数，是一个数组，根据模版字符串的规则获取的
    const _args = arguments;
    // 返回一个函数组件
    return function Styled(props) {
      // 1. 浅拷贝了一下 props 2. 挂在了上下文对象上
      const _props = _ctx.p = Object.assign({}, props);
      // 处理 className
      const _previousClassName = _props.className;

      _ctx.o = /\s*go[0-9]+/g.test(_previousClassName);
      // css.apply(_ctx, _args) 这里挂在了同一个上下文，所以 css 方法中可以拿到挂载的 p、o 并且 apply 还会展开 arguments
      // css 方法返回一个 hash
      _props.className = css.apply(_ctx, _args) + (_previousClassName ? " " + _previousClassName : "");

      // 返回一个组件
      return h(
        tag,
        _props
      );
    };
  };
}

export { styled, setPragma };
```

## [css.js]()

```js
import { hash } from "./core/hash";
import { compile } from "./core/compile";
import { getSheet } from "./core/get-sheet";

/**
 * css entry
 * @param {String|Object|Function} val
 */
function css(val) {
    // 讲道理这里的上下文就是 styled 中的上下文对象，所以可以拿到 ctx.p ctx.o 的
    const ctx = this || {};
    // 如果 val 是一个函数，比如：styled('div')(props => `disply: flex`)

    // ⚠️ 这里的参数 val 是有几种情况的：
    // 1. 是个字符串，比如 styled('div')`hello world!` val = 'hello world!'
    // 2. 是个函数，比如 styled('div')(p => `hello world!`) val = p => 'hello world!'
    // 3. 是个数组，比如 styled('div')`hello ${name}!` 完整参数此时是这 [['hello', ''], 'tom']，所以此时 val = ['hello', '']
    const _val = val.call ? val(ctx.p) : val;

    // 到这里就要分别看看 hash compile getSheet 这几个方法了
    return hash(
        // 1. 先看看这个 compile 方法，这里就是判断是数组就走这个方法，特意将参数第一位截了，
        // 因为第一个参数就是字符串数组，之后的才是依赖
        // 这里的 arguments 就是 css 函数的完整参数，其实就是 styled 中的 _args
        _val.map ? compile(_val, [].slice.call(arguments, 1), ctx.p) : _val,
        getSheet(ctx.target),
        ctx.g,
        ctx.o
    );
}

/**
 * CSS Global function to declare global styes
 */
const glob = css.bind({ g: 1 });

export { css, glob };
```

## [compile.js](https://github.com/cristianbote/goober/blob/master/src/core/compile.js)

```js
/**
 * Can parse a compiled string, from a tagged template
 * @param {String} value
 * @param {Object} [props]
 */
export const compile = (str, defs, data) => {
    // 这里就很简单了，就是拼字符串出来
    return str.reduce((out, next, i) => {
        let tail = defs[i];
    
        // ⚠️：这是我看 2019-12-11 号新的 PR 的代码，我觉得更好理解一点
        // PR URL: https://github.com/cristianbote/goober/pull/68/files#diff-3
        // If this is a function we need to:

        // ⚠️：这里其实是针对 className 处理的情况，如果看的懵逼就结合测试 case 一起看
        if (tail && tail.call) {
          // 1. Call it with `data`
          const res = tail(data);

          // 2. Grab the className
          const className = res && res.props && res.props.className;

          // 3. If there's none, see if this is basically a
          // previously styled className by checking the prefix
          const end = className || (/^go/.test(res) && res);

          tail = (end
            // If the `end` is defined means it's a className
            ? "." + end
            // If `res` it's not a vnode, we could just dump it
            // since the value it's an dynamic value
            : (res.props ? "" : res));
        }
        return out + next + (tail || "");
      }, "");
}
```


## [hash](https://github.com/cristianbote/goober/blob/master/src/core/hash.js)

```js
import { toHash } from "./to-hash";
import { update } from "./update";
import { astish } from "./astish";
import { parse } from "./parse";

/**
 * In-memory cache.
 */
let cache = {
    c: 0
};

/**
 * Generates the needed className
 * @param {String|Object} compiled
 * @param {Object} sheet StyleSheet target
 * @param {Object} g Global flag
 * @param {Object} append Append or not
 * @returns {String} 
 */
export const hash = (compiled, sheet, g, append) => {
    // generate hash
    const compString = JSON.stringify(compiled);
    const className = cache[compString] || (cache[compString] = g ? "" : toHash(compString));

    // Parse the compiled
    const parsed = cache[className] || (
        cache[className] = parse(
            compiled[0] ? astish(compiled) : compiled,
            className
        )
    );

    // add or update
    update(parsed, sheet, append);

    // return hash
    return className.slice(1);
};
```
