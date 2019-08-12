# anu

>项目[地址](https://github.com/RubyLouvre/anu)
>
>作者: [司徒正美](https://github.com/RubyLouvre)



[官网地址](https://rubylouvre.github.io/anu/)

这个项目放的东西比较多，准备从 [anu](https://github.com/RubyLouvre/anu/blob/master/packages/readme.md) 这块儿入手开始看。至于多端编译的 [nanachi](https://rubylouvre.github.io/nanachi/index.html)，现在各家也在做这方面的东西，也很好奇司徒是怎么去实现的。

文件的目录结构，司徒在文档中有说明，我直接 `copy` 过来。

👇

***

core: 放置一些公用接口

fiber: 放置调度器，比较有趣. 包含有时间分片，错误处理，批量更新，任务收集，任务分拣。。。

render: 放置渲染层的具体实现，比如createElement, 在dom里面就是document.createElement, 它会考虑到复杂的文档空间切换; 

在noop里只是一个包含type, props, children的纯对象; 在server里面就是可以一个能序列化为字符串的对象。

---

司徒认真研究了 `React` ，并在自己的理解上实现了 `anu`，学习这个框架的过程中，应该忘记 `React` 的一些知识点，从零开始去研究 `anu` 这个框架，最后完全理解司徒的设计和实现的时候，其实 `React` 应该也就懂了。



## Directory Structure

- [router: reach-router 的改造版](./router/readme.md)