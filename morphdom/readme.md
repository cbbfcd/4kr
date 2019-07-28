# morphdom

> [项目地址](https://github.com/patrick-steele-idem/morphdom)
>
> 项目作者: [patrick-steele-idem](https://github.com/patrick-steele-idem)



# About

这个库与时下热门的 `virtua-dom` 库本质上是一致的，都是关注的最小变化，然后响应式的映射到视图更新。只是 `React` 之类的库中使用了 `virtual-dom` 的结构来 `diff` 出最小变化，`morphdom` 则是直接比较的真实 `DOM` 节点。

一种简单粗暴的更新 `DOM` 的方式就是使用  `container.innerHTML = newHTML` 。这种直接**替换**的方式肯定是极其快的，但是它也彻底的忽略了诸如滚动位置、`CSS` 动画等特征。

而 `morphdom` 通过从 `fromEl` 到 `toEl` 的**转换**过程中找出最小变化，以最大限度的减少对目标 `DOM` 的更改！

很多人认为 `DOM` 一定就是慢的，因为 `DOM` 操作和 `JS` 代码在不同的引擎执行，通过接口的方式连接，所以操作 `DOM` 会有开销，并且最主要的一些 `DOM` 属性的访问是会引发 `relayout` 的，比如 `offSetWidth`，因为浏览器必须回流以确定最新的宽度，好在 `morphdom` 根本不访问这些危险的属性，所以它是极快的！文档中也给出了 `benchmark`，可以看出在一些**小**变化前，比 `virtual-dom` 更快，但是对于大量变化的处理， `virtual-dom` 更具优势。

 `rendering to an HTML string` 的方式比起 `rendering virtual DOM nodes` 的方式在 `SSR` 的场景下更有优势（因为少了一层序列化的过程）。

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

