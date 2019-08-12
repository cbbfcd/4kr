# constate

> [项目地址](https://github.com/diegohaz/constate)
>
> 作者：[diegohaz](https://github.com/diegohaz)



# About

使用起来非常简单：

```javascript
import React, { useState } from "react";
import createUseContext from "constate";

// 1️⃣ Create a custom hook as usual
function useCounter() {
  const [count, setCount] = useState(0);
  const increment = () => setCount(prevCount => prevCount + 1);
  return { count, increment };
}

// 2️⃣ Wrap your hook with the createUseContext factory
const useCounterContext = createUseContext(useCounter);

function Button() {
  // 3️⃣ Use context instead of custom hook
  const { increment } = useCounterContext()
  return <button onClick={increment}>+</button>;
}

function Count() {
  // 4️⃣ Use context in other components
  const { count } = useCounterContext()
  return <span>{count}</span>;
}

function App() {
  // 5️⃣ Wrap your components with Provider
  return (
    <useCounterContext.Provider>
      <Count />
      <Button />
    </useCounterContext.Provider>
  );
}
```



# Plot

利用  `context`  +  `hooks` 来实现状态管理，需要注意的一个点就是 `context` 的变化会引起使用了该 `context` 的所有组件[更新](https://zh-hans.reactjs.org/docs/hooks-reference.html#usecontext)，所以一般会加上 `useMemo` 之类的优化。更重要的还是使用的时候，进行拆分，不要使用一个 `store`。

其代码实现很简单，不到 `50` 行代码：

```javascript
function warnProvider() {
  console.warn('[Constate] Missing Provider.');
}

const canUseProxy = process.env.NODE_ENV === 'development' && typeof proxy !== 'undefined';

const defaultValue = canUseProxy
  ? new Proxy({}, {get: warnProvider, apply: warnProvider})
  : {};

function createUseContext(useValue, createMemoInputs) {
  // 如果没有提供 Provider，往下传的 value 就是 defaultValue，使用会触发报错
  // 这设计还是挺有意思的
  // https://zh-hans.reactjs.org/docs/context.html#contextconsumer
  const Context = React.createContext(defaultValue);
  
  const Provider = props => {
    const value = useValue(props);
    const memoizedValue = createMemoInputs
      ? useMemo(() => value, createMemoInputs(value))
      : value;
    return (
      <Context.Provider value={memoizedValue}>
        {props.children}
      </Context.Provider>
    )
  }

  if (useValue.name) {
    Context.displayName = `${useValue.name}.Context`;
    Provider.displayName = `${useValue.name}.Provider`;
  }

  const useContext = () => React.useContext(Context);
  // 可以通过 useContext() 获取 context，也可以通过 Consumer + renderProps
  useContext.Context = Context;
  useContext.Provider = Provider;
  return useContext;
}

```



同类型的还有好几个库，比如新一代的 [unstate-next](https://github.com/jamiebuilds/unstated-next)，你去看代码，发现实现大同小异。