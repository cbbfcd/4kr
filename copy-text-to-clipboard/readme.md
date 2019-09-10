# copy-text-to-clipboard

> [项目地址](https://github.com/sindresorhus/copy-text-to-clipboard)
>
> 项目作者：[sindresorhus](https://github.com/sindresorhus)

## About

代码真的很少，直接贴出来。

```javascript
'use strict';

// 1. 用一个表单元素 textarea 来存目标字符串
// 2. 用 selection 选中这个文本
// 3. execCommand('copy')
// 4. GC & 释放
const copyTextToClipboard = input => {

    // 关于 textarea: https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/textarea
	const element = document.createElement('textarea');

	element.value = input;

    // Prevent keyboard from showing on mobile
    // 不允许用户修改元素内文本。和 disabled 属性不同的是，这个能让用户点击和选择元素内的文本
    // 这里设置空串是之前在 morphdom 源码分析中关于 property 和 attribute 的区别内容提到过，只要有这个字段就行，就是 true
    // 移除该熟悉必须 removeAttribute()。这里写这个的原因作者也说明了，就是针对移动端的一些处理
	element.setAttribute('readonly', '');

    // contain 还是比较有趣的：它和它的子元素的DOM变化不会触发父元素重新布局、渲染等，是被隔离的
    // http://www.webhek.com/post/css-contain-property.html
    // https://zhuanlan.zhihu.com/p/30618818
	element.style.contain = 'strict'; // 让一个视图外的节点不被渲染，彼此隔离
	element.style.position = 'absolute';
	element.style.left = '-9999px';
	element.style.fontSize = '12pt'; // Prevent zooming on iOS

    // https://developer.mozilla.org/zh-CN/docs/Web/API/Selection
	const selection = document.getSelection();
	let originalRange = false;
	if (selection.rangeCount > 0) {
		originalRange = selection.getRangeAt(0);
	}

    // https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLInputElement/select
	document.body.append(element);
	element.select(); // 让 textarea 的文字被选中，要放进 dom tree 才会有效

	// Explicit selection workaround for iOS
	element.selectionStart = 0;
	element.selectionEnd = input.length;

	let isSuccess = false;
	try {
		isSuccess = document.execCommand('copy');
	} catch (_) {}

	element.remove();

    // 这里其实是处理的之前选中的，将其恢复
	if (originalRange) {
		selection.removeAllRanges();
		selection.addRange(originalRange);
	}

	return isSuccess;
};

module.exports = copyTextToClipboard;
// TODO: Remove this for the next major release
module.exports.default = copyTextToClipboard;
```