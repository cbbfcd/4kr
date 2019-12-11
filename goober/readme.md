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
        // https://github.com/cristianbote/goober/pull/68/files#diff-a785c8e0c9a37fab4a83fe40d77a5ba9
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

## [getSheet](https://github.com/cristianbote/goober/blob/master/src/core/get-sheet.js)

```js
const GOOBER_ID = "_goober";
const ssr = {
    data: ""
};
export const getSheet = target => {
    try {
        // https://www.zhangxinxu.com/wordpress/2017/07/js-window-self/
        let sheet = target ? target.querySelector('#' + GOOBER_ID) : self[GOOBER_ID];
        if (!sheet) {
            let _target = target || document.head;
            // 注意这里的字符串是有一个空格的，所以获取到的 firstChild nodeType === 3
            _target.innerHTML += '<style id="' + GOOBER_ID + '"> </style>';
            sheet = _target.lastChild;
        }
        return sheet.firstChild;
    } catch (e) {}
    return ssr;
};
```


## [hash](https://github.com/cristianbote/goober/blob/master/src/core/hash.js)

```js
// 这几个方法比较简单，就不粘贴出来了，可以自行看看
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
    // toHash 就是每一个 char | 8 然后全部加起来得到的数字
    const className = cache[compString] || (cache[compString] = g ? "" : toHash(compString));

    // Parse the compiled
    const parsed = cache[className] || (
        cache[className] = parse(
            // 这个方法里面有一些比较复杂的正则，涉及捕获分组啥的
            // 可以使用正则可视化工具看看：http://wangwl.net/static/projects/visualRegex/#flags=gi&source=%2F(%3F%3A(%5Ba-z0-9-%25%40%5D%2B)%20*%3A%3F%20*(%5B%5E%7B%3B%5D%2B%3F)%3B%7C(%5B%5E%3B%7D%7B%5D*%3F)%20%2B%7B)%7C(%7D)%2F&match=prop%3A%20%7B%20a%3A%201%7D%3B&method=exec
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

## [parse.js](https://github.com/cristianbote/goober/blob/master/src/core/parse.js)

```js
/**
 * Parses the object into css, scoped, blocks
 * @param {Object} obj 
 * @param {String} paren 
 * @param {String} wrapper 
 */
export const parse = (obj, paren, wrapper) => {
    let current = "";
    let blocks = "";
    let outer = "";
    
    // If we're dealing with keyframes just flatten them
    if (/^@[k|f]/.test(wrapper)) {
      // Return the wrapper, which should be the @keyframes selector
      // and stringify the obj which should be just flatten 
      return wrapper + JSON.stringify(obj).replace(/","/g, ";").replace(/"|,"/g, "").replace(/:{/g, "{");
    }
    
    for (let key in obj) {
        const val = obj[key];
        
        // If this is a 'block'
        if (typeof val === "object") {

            // Regular selector
            let next = paren + " " + key;
            
            // Nested
            if (/&/g.test(key)) next = key.replace(/&/g, paren);
    
            // Media queries or other
            if (key[0] == '@') next = paren;
    
            // Call the parse for this block
            blocks += parse(val, next, next == paren ? key : wrapper || '');
        } else {
            if (/^@i/.test(key)) outer = key + " " + val + ";";
            // Push the line for this property
            else current += key.replace(/[A-Z]/g, "-$&").toLowerCase() + ":" + val + ";";
        }
    }
    
    // If we have properties
    if (current.charCodeAt(0)) {
        // Standard rule composition
        const rule = paren + "{" + current + "}";
        
        // With wrapper
        if (wrapper) return blocks + wrapper + "{" + rule + "}";
    
        // Else just push the rule
        return outer + rule + blocks;
    }
  
    return outer + blocks;
};
```

# so

整理一下实现思路：

利用模版字符串的能力，实现一个最终返回组件的函数，这里面 mixin 进去了 className 到 props 里面。

组件有了类名，剩下的就应该是把样式表给弄到 header 里面去，这个是在 css 方法里面的 hash 中实现的。

所以就是很简单的思想，我给组件整一个类名，这个类名对应的 css 我加到 header 中，ok，那就完事儿了。

