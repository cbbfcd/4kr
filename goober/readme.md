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
    const _val = val.call ? val(ctx.p) : val;

    // 到这里就要分别看看 hash compile getSheet 这几个方法了
    return hash(
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
