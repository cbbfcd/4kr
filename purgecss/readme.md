# purgecss

> [项目地址](https://github.com/FullHuman/purgecss)
>
> 项目作者：[FullHuman](https://github.com/FullHuman)

# about

这个项目目的单纯，就是消除没使用到的 `css`，从而减少打包的体积，具体的信息参见[官方文档](https://github.com/FullHuman/purgecss)

对配置参数，可以参见[文档](https://www.purgecss.com/configuration)

# learn

代码不多，一个 `class` 就搞定了，结构设计的很合理，不多不少，值得细细品味一下，主要还是可以学习一下 `postcss` 的神奇之处。

其实某种程度上和 `babel` 是差不多的，就是把 `css` 的字符串转成了 `AST` 树，然后通过一些工具函数，给你操作这个树的能力，最后再输出转译后的字符串。

可以对比 [`AST`](https://astexplorer.net/) 学习一下。

[源码学习](./index.js)