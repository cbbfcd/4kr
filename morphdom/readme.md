# morphdom

> [项目地址](https://github.com/patrick-steele-idem/morphdom)
>
> 项目作者: [patrick-steele-idem](https://github.com/patrick-steele-idem)



# About

这个库与时下热门的 `virtua-dom` 库本质上是一致的，都是关注的最小变化，然后响应式的映射到视图更新。只是 `React` 之类的库中使用了 `virtual-dom` 的结构来 `diff` 出最小变化，`morphdom` 则是直接比较的真实 `DOM` 节点。

一种简单粗暴的更新 `DOM` 的方式就是使用  `container.innerHTML = newHTML` 。这种直接**替换**的方式肯定是极其快的，但是它也彻底的丢失了诸如滚动位置、`CSS` 动画等信息。

而 `morphdom` 通过从 `fromEl` 到 `toEl` 的**转换**过程中找出最小变化，以最大限度的减少对目标 `DOM` 的更改！同时还保留了所有关键的信息。

很多人认为 `DOM` 一定就是慢的，因为 `DOM` 操作和 `JS` 代码在不同的引擎执行，通过接口的方式连接，所以操作 `DOM` 会有开销，并且最主要的一些 `DOM` 属性的访问是会引发 `relayout` 的，比如 `offSetWidth`，因为浏览器必须回流以确定最新的宽度，好在 `morphdom` 根本不访问这些危险的属性，所以它是极快的！文档中也给出了 `benchmark`，可以看出在一些**小**变化前，比 `virtual-dom` 更快，但是对于大量数据的处理， `virtual-dom` 更具优势。

 `rendering to an HTML string` 的方式比起 `rendering virtual DOM nodes` 的方式在诸如 `SSR` 的场景下更有优势（因为少了一层序列化的过程）。

...

请参见[文档](https://github.com/patrick-steele-idem/morphdom)。细读下来，总有收获。

使用：

```javascript
var morphdom = require('morphdom');
// toNode 也可以是字符串：'<h1 id="h1">Hello World</h1>'
var morphedNode = morphdom(fromNode, toNode, {
    getNodeKey: function(node) {
        return node.id;
    },
    onBeforeNodeAdded: function(node) {
        return node;
    },
    onNodeAdded: function(node) {

    },
    onBeforeElUpdated: function(fromEl, toEl) {
        return true;
    },
    onElUpdated: function(el) {

    },
    onBeforeNodeDiscarded: function(node) {
        return true;
    },
    onNodeDiscarded: function(node) {

    },
    onBeforeElChildrenUpdated: function(fromEl, toEl) {
        return true;
    },
    childrenOnly: false
});
```



# Plot

### `index.js`

导出 `morphdom` 方法。

```javascript
var morphdom = morphdomFactory(morphAttrs);
export default morphdom
```

### `util.js`

工具方法着实有趣，值得探究一下：

```javascript
var range;
// html 的命名空间，目的就是基于 xml 的标记语言混用的时候能够辨别
// https://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/glossary.html#dt-namespaceURI
var NS_XHTML = 'http://www.w3.org/1999/xhtml';
var doc = typeof document === 'undefined' ? undefined : document;

/**
* 把字符串形式的节点转为 DOM 对象
* toElement('<h1>hello world</h1>') => h1
* 等同于：
* var html = new DOMParser().parseFromString(str, 'text/html');
* return html.body.firstChild;
*
* 最有意思的就是其实现这一功能的方式，利用了 Range 对象（IE9+）
* https://developer.mozilla.org/zh-CN/docs/Web/API/Range
*/
export function toElement(str) {
  if(!range && doc.createRange) {
     range = doc.createRange();
     range.selectNode(doc.body);
  }
  var fragment;
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Range/%E5%88%9B%E5%BB%BA%E4%B8%8A%E4%B8%8B%E6%96%87%E7%89%87%E6%AE%B5
  if(range && range.createContextualFragment) {
    // DocumentFragment 不会引起回流
    // DocumentFragment 也可以直接添加到 DOM 中，不会添加自己，只是 append 其子元素节点
    fragment = range.createContextualFragment(str);
  }else {
    // innerHTML 的方式
    fragment = document.createElement('body');
    fragment.innerHTML = str;
  }
  // 貌似 childNodes[0] 和 firstChild 差不多，都有坑（会取文本节点）
  // 对 morphdom 来说，文本节点并不是多余的
  return fragment.childNodes[0];
}
```

如果是将一段字符串文本转化为实际的 `DOM` 节点的话，大致有三种方式：

- `innerHTML` 

    ```javascript
let fragment = document.createElement('body');
fragment.innerHTML = htmlStr;
return fragment.firstChild;
    ```

- `DOMParser`

```javascript
let fragment = new DOMParser().parseFromString(htmlStr, 'text/html');
return fragment.firstChild;
```

- `DocumentFragment`

```javascript
let fragment = document.createRange().createContextualFragment(htmlStr);
return fragment.firstChild;
```

感兴趣的童鞋可以做 `benchmark`，肯定 `DOMParser` 是最慢的。而 `innerHTML` 和 `DocumentFragment` 的方式差不太多。当然最快的是`DocumentFragment`, 具体可参考[三者性能比较](https://jsperf.com/str-to-element/1)。