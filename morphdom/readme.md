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
return fragment.body.firstChild;
```



- `DocumentFragment`

```javascript
let fragment = document.createRange().createContextualFragment(htmlStr);
return fragment.firstChild;
```



感兴趣的童鞋可以做 `benchmark`，肯定 `DOMParser` 是最慢的。而 `innerHTML` 和 `DocumentFragment` 的方式实际测试差不太多。当然最快的还是`DocumentFragment`, 具体可参考[三者性能比较](https://jsperf.com/str-to-element/1)。

```javascript
// 比较两个节点的名字
export function compareNodeNames(fromEl, toEl) {
  var fromNodeName = fromEl.nodeName;
  var toNodeName = toEl.nodeName;
  
  if(fromNodeName === toNodeName) return true;
  
  // 对于虚拟 DOM，其名字可能不是大写的。
  if(toEl.actualize && fromNodeName.charCodeAt(0) < 91 && toNodeName.charCodeAt(0) > 90) {
    return fromNodeName === toNodeName.toUpperCase();
  }else {
    return false;
  }
}

// 创建元素节点（命名空间）
export function createElementNS(name, namespaceURI) {
  // 如果是 HTML 元素或者没有指定命名空间
  return !namespaceURI || namespaceURI === NS_XHTML
    ? document.createElement(name)
    : document.createElementNS(namespaceURI, name);
}

// 把一个节点的所有子元素拷贝到另一个节点中 
export function moveChildren(fromEl, toEl) {
  // 这是一个常用技巧，通过遍历兄弟节点实现拷贝
  var curChild = fromEl.firstChild;
  while(curChild) {
    var nextChild = curChild.nextSibling;
    toEl.appendChild(curChild);
    curChild = nextChild;
  }
  return toEl;
}
```



### `morphAttrs.js`

对  `fromNode`  和 ` toNode`  进行  `Diff`  并  `Patch`  到原始节点。实现就是遍历  `toNode`  节点的属性与 `fromNode` 做比较，然后更新 `fromNode`，再删除已经不在 `toNode`  的属性。 

```javascript
export default function morphAttrs(fromNode, toNode) {
  // 一堆变量声明，很好理解，命名规范就是这么舒服
  var attrs = toNode.attributes;
  var i;
  var attr;
  var attrName;
  var attrNamespaceURI;
  var attrValue;
  var fromValue;
  
  // 更新原始 DOM 的属性
  for (i = attrs.length - 1; i >= 0; --i) {
    attr = attrs[i];
    attrName = attr.name;
    attrNamespaceURI = attr.namespaceURI;
    attrValue = attr.value;
    
    // 处理 XML 文档
    if (attrNamespaceURI) {
      attrName = attr.localName || attrName; // 这个 API 废弃了都
      fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
      
      if (fromValue !== attrValue) {
        fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
      }
    }
    else {
      fromValue = fromNode.getAttribute(attrName);
      
      if (fromValue !== attrValue) {
        fromNode.setAttribute(attrName, attrValue);
      }
    }
    
    // 如果节点属性不再出现在 toNode 中，那么就移除 fromNode 中的同名属性
    attrs = fromNode.attributes;
    
    for (i = attrs.length - 1; i >= 0; --i) {
      attr = attrs[i];
      // 检测这个属性是不是被声明了，有没有赋值，是不是标准属性名都算
      if (attr.specified !== false) {
        attrName = attr.name;
        attrNamespaceURI = attr.namespaceURI;
        
        if (attrNamespaceURI) {
          attrName = attr.localName || attrName;
          
          // 新节点没有就移除老节点对应的属性
          if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
            fromNode.removeAttributeNS(attrNamespaceURI, attrName);
          }
        }
        else {
          if (!toNode.hasAttribute(attrName)) {
            fromNode.removeAttribute(attrName);
          }
        }
      }
    }
  }
}
```



关于 `attr.spcified`，可以参考这里的[讨论](https://stackoverflow.com/questions/14489237/what-is-attribute-specified-for-a-dom-elements-attributes)和[规范](https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-637646024)，总的来说，抛开 `IE` 浏览器这个大坑，现代浏览器中都支持的很好，其作用类似于 `element.hasAttribute(attrName)`。



### `specialElHandlers.js`

这个里面应该有一些黑科技或者冷门知识点，不然就不够 `special` 了。😄

```javascript
// 同步 Boolean 属性，比如 disabled checked selected
// 为啥要有这么一步处理呢？方法名中也暗藏玄机，就是引出一个问题： attributes 和 properties 的区别！
function syncBooleanAttrProp(fromEl, toEl, name) {
  if (fromEl[name] !== toEl[name]) {
    fromEl[name] = toEl[name];
    // 比如用 disabled attribute 来禁用/取消禁用，只需要 set/remove 掉该 attribute
    if (fromEl[name]) {
      fromEl.setAttribute(name, '');
    }
    else {
      fromEl.removeAttribute(name);
    }
  }
}

export default {
  
}
```



#### `what's the difference between attributes and properties in HTML?`

这里附上 [stackoverflow 上的一篇问答](https://stackoverflow.com/questions/6003819/what-is-the-difference-between-properties-and-attributes-in-html)。其中高票答案真心不错！下边还有一个更通俗易懂的答案也值得参考。

> **The HTML attribute and the DOM property are different things, even when they have the same name.**

如果不想看链接，大致说明一下：

首先需要明确的就是 `attributes` 和 `properties` 虽然可能名字会一样或者类似，但是绝对不是一个东西。有坑的！

一般我们通过  `node.xxx`  获取  `properties`，通过 `node.getAttribute('xxx')` 获取 `attributes`。

```javascript
<input id="id" type="text" value="hello"/>
  
// inputNode.value 和 inputNode.getAttribute('value') 获取的结果只有初始是一致的
// 当你输入 'world' 的时候，再获取上面的值，前者是 'world'，后者依然是 hello
```



一些情况：

- 诸如  `id` ，不管是 `properties` 或者 `attributes` 获取的表现都是一致的

- `input`  的 `value` 这类的如上。

- `disabled`  这种更坑，初始化的时候 `disabled property` 肯定是 `false` 的，但是当你增加一个 `disabled attirbute`，不管设置什么值，都是禁用。 

```javascript
// 默认 btn.disabled 是 false
// 然后，设置 btn.setAttribute('disabled', 'false')，其实随便设置啥值都行，
// 只要有 diabled 这个 attribute 存在，就是禁用了，无关其值。除非 remove 掉该 attribute！
```

