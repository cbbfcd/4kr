# reach-router

> [项目地址](https://github.com/reach/router)
>
> 作者: [Ryan Florence](https://github.com/ryanflorence)



[官方网站](https://reach.tech/router)

# About

[知乎真香介绍](https://zhuanlan.zhihu.com/p/37718650)

[reach-react-router-future](https://reacttraining.com/blog/reach-react-router-future/)

[youtube 视频介绍](https://www.youtube.com/watch?v=J1vsBrSUptA)

学习 `reach-rouer` 的第一步，最好是多看几篇介绍的文章，有个大概的了解，然后就是照着官网撸一遍，先学会用，再试着去理解它的设计。好在官网介绍的还是比较详尽的，还贴心的准备了 `example` ，上手还是很快的。

文件结构：

```javascript
/**
*  lib              -- 核心包，包含工具方法和简化版 history
*    ·history.js    -- mini history 实现
*    ·utils.js      -- 工具包
*  index.js         -- 连接 React 的主模块
*/
```

源码分析：

- `lib` 
  - [`history.js`](./lib/history.js)
  - [`utils.js`](./lib/utils.js)
- [`index.js`](./index.js)

> 单元测试被忽略掉了，其实可以学习一下怎么去写一个全面的单测。

# Think About

### [`./lib/history.js`](./lib/history.js)

`react-router` 有一个 `history` 库，但是作者想要更简单一点，`reach-router` 中直接抛弃了 `hash` 等方式，直接采用 `H5`新增加的 `history API` 实现，体积大大减小，而且兼容性很不错（`IE10+`）。


其实没啥特别说的，实现的本质都是一样的，对于 `history API` 来说，就是监听 `popstate` 事件和在进行 `replaceState\pushState` 的时候手动触发监听，这样就基本覆盖所有情况了。


作者其实就实现了 `listen` 和 `navigate` 两个函数，`listen` 不用多说，都必须有的，收集监听函数，然后在路由改变的时候触发。`navigate` 函数就是 `Link to` 组件的函数版本，一样的是执行 `replaceState/pushState` 然后手动的跑完 `listeners`，特别的地方就是返回了一个待决议的 `Promise` ，而决议的执行会放在 `React completely finished` 的阶段。具体我在源码中有很详细的注释，可以点击标题看看。

### [`./lib/utils.js`](./lib/utils.js)

工具包中比较有意思的是评分和处理相对路径的函数，这也是 `reach-router` 最吸引人的特色点。

排名的方式是给 `uri` 解析出的每一段都给个基础分，然后其类型有额外的分数，比如是动态路由（`eg: /user/:id`）就有 `2` 分，静态路由 `3` 分，然后用一个 `reduce` 函数计算出每个 `path` 对应的分数，所以只选择最高分的就很容易了。

处理相对路径上，作者的意图是让用户定义路由的时候有种使用 `cli path` 的感觉，甚至可以 `../../`，实现也很简单，整个路由地址被切片之后，只需要匹配 `..` 的情况的时候就 `pop`，不是 `.` 的情况再 `push`，最后 `join` 出的地址就是满足要求的了，当然你也可以不使用相对路由，都行。

但是看的时候还是有一些疑惑的地方，估计只能在 `index.js` 文件中找到答案。

### [`index.js`](./index.js)

TODO