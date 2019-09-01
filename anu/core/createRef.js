export function createRef() {
    // https://zh-hans.reactjs.org/docs/react-api.html#reactcreateref
    return {
        current: null
    }
}

// 返回一个组件，将接收到 ref 分发给子组件
export function forwardRef(fn) {
    // https://zh-hans.reactjs.org/docs/react-api.html#reactforwardref
    return function ForwardRefComponent(props) {
        // 这里的 this 让我觉得怪怪的
        // 讲道理 function component 是没有 this 的，这里的意思是指向了实例
        return fn(props, this.ref);
    }
}