# Gibberish About React 

> 胡乱的记录一些笔记和思考，没有营养，不值得参考

---

- 交互式 UI❓
- 声明式编写 UI❓
  
  > 我觉得 `React` 就是大道至简的设计哲学，虽然它本身还是很复杂。它目的是提供最简单、高效的方式让开发者能够建立交互式的 `UI`，这也说明 `React` 就是在 `UI` 层面做文章，提供了不一样的开发体验，落到实处其实就是一种简单的设计，状态对应视图，状态的更新决定了视图的更新。
  
  > `UE/UI` 设计师决定了视图层的效果，开发者关注的仅仅是对这份视觉稿进行拆分和抽象，往更简单、更粒度的方向去设计对应的状态，并与视图一一对应。
  
  > `React` 为每一个组件（`Hooks` 之后，`Function Component` 也等同于拥有了自己的状态）提供了内部的状态（`state`，`props`都归为状态，只是不同的存在形式，一个是内部维护的状态，一个是在流转中的状态），通过这个状态来反映视图，状态又可以传递（不管是同级还是嵌套，总之有的是办法）这就等同于组件之间有了通信，这样就具备了构建更复杂的 `UI` 层次的能力，就像修房子，一砖一瓦一木作为基石，形成一块块结构，最终构成房子。

  > 关于命令式编程、声明式编程、响应式编程，可参考知乎：[声明式编程和命令式编程有什么区别？](https://www.zhihu.com/question/22285830?from=profile_question_card)，[响应式编程（Reactive Programming）介绍](https://zhuanlan.zhihu.com/p/27678951)、[从年会看声明式编程(Declarative Programming)](https://zhuanlan.zhihu.com/p/26085755)

  > 声明式编程的设计意味着 `React` 在底层做了大量的工作，让开发者更关注于业务，更方便调试，更爽，这不是银弹。`React` 采用这种设计方式，上层（开发者层面）只需要关注你想得到一个什么样的结果，中间如何实现的过程完全由 `React` 接管，底层变动对上层来说是无感知的，他们维护升级也方便，我们用起来也开心。


- jsx ❓

  > 首先，我很喜欢 `jsx`。
  > 为什么要使用 `jsx`？这个[官方文档](https://zh-hans.reactjs.org/docs/introducing-jsx.html#why-jsx)解释的很清楚。
  > 我其实关注的是，为啥每个组件文件必须写一个 `import React from 'react';`，这个和 `jsx` 是不是有关系？
  > `babel` 现在是 `React` 官方推荐的提供 `jsx` 支持能力的工具，那么，如何实现的呢？
  > 其实可以参考 `babel-transform-react-jsx` 的[实现](https://github.com/babel/babel/blob/master/packages/babel-plugin-transform-react-jsx/src/index.js)，上面的问题就引刃而解了，必须 `import React` 是因为要执行 `React.createElement`，需要注入 `React` 对象到这个模块的上下文。
  
  > 对于怎么实现的，我把文件摘出来，写了详细的注释。参见[babel-jsx-plugin](./jsx/index.js)
  > *PS：了解一下 babel 插件挺好的！*
  
  > 也就是说你写的 `jsx` 最终经过 `babel` **转译** 一下，就变成了 `React.createElement(xxx)` 这样的调用了。而这个方法最终返回的就是一个对象（`虚拟 DOM`）。


- 元素 ❓

  > 元素应该是 `React` 中的最小单元了，其实质就是一个对象 `{type, props, key, ref, self, source, owner}`。
  > 创建元素的方法 [createElement](https://github.com/facebook/react/blob/master/packages/react/src/ReactElement.js#L312)
  > 看代码可知，`react element` 在生产环境下是不可变对象，不可增删属性，不可更改`writable、configurable、enumable`，总之，不可变的。
  > 具体实现参考 [Object.freeze](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)

  > 元素是 `react` 世界中的砖瓦，组件是由 *元素 + UI逻辑* 构成

  > 因为元素是不可变的，所以其映射到 `DOM` 上的视图如果要更新，肯定是传人了新的元素然后再 `ReactDom.render` 一次。这样的开销可想而知，为了解决这个问题，`React` 中增加了状态来更新视图。
  > 当然还有 `diff`，`scheduler` 这些是后边的内容，不要着急

  > 文档中已经提到了 `react` 最核心的一个特性：只更新它需要更新的！具体怎么实现的，继续探索。


- 组件 & props ❓

  > 组件可以看成是一个函数，函数执行后返回一个 `react` 元素。
  > props 就是组件之间的数据通信桥梁，虽然是单向向下的，也可以通过回调之类的方式逆向通信
  > props 是不可变的，组件应该是一个纯函数，接收一样的 props，就一定有一样的输出。那么如何处理副作用？别忘了还有 `state`！
  > 组件有两种形式，一种是函数式的组件，一种是 `class` 组件。两者等价，只是在一些能力上有所不同。

  > 对于 [class 组件](https://github.com/facebook/react/blob/master/packages/react/src/ReactBaseClasses.js)，可以见这里的实现。
  