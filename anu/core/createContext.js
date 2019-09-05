import { miniCreateClass, isFn, get } from './utils';
import { Component } from './Component';
import { Renderer } from './createRenderer';

// context 优化了用法外最大的改进在于： 
//   1. 可以支持细粒度的控制更新（通过 unstable 的 API），在 Provider 中的 value 发生改变时，
// 其所有的消费组件都更新，可能造成浪费，之前大多优化的方法是让用户把 context 拆分的细一点，让这种影响降低。

//   2. shouldComponentUpdate 不会再阻断 context value 向下传递的路径，从而阻塞更新

// 数组的最大容量
const MAX_NUMBER = 1073741823;
// https://zh-hans.reactjs.org/docs/context.html#reactcreatecontext
// https://zhuanlan.zhihu.com/p/42654080
// calculateChangedBits 很有意思
export function createContext(defaultValue, calculateChangedBits) {
    // calculateChangedBits 默认值是 null
    if (calculateChangedBits == void 0) {
        calculateChangedBits = null
    }

    // 这里定义的目的是，就算不提供 Provider 也可以使用 context api 的一些功能（仅仅是值穿透，无更新的能力了）
    var instance = {
        value: defaultValue,
        subscribers: []
    }

    var Provider = miniCreateClass(
        function Provider(props) {
            this.value = props.value;
            getContext.subscribers = this.subscribers = [];
            instance = this;
        },
        Component,
        {
            componentWillUnmount: function componentWillUnmount() {
                this.subscribers.length = 0;
            },
            UNSAFE_componentWillReceiveProps: function UNSAFE_componentWillReceiveProps(nextProps) {
                // 整体就是通过发布订阅的机制，绕过 shouldComponentUpdate 的检查
                if (this.props.value !== nextProps.value) {
                    var oldValue = this.props.value;
                    var newValue = nextProps.value;
                    var changedBits = void 0;
                    // 这一步？？
                    if (Object.is(oldValue, newValue)) {
                        changedBits = 0;
                    }
                    else {
                        this.value = newValue;
                        // changedBits 只要等于 0 就不会更新了。不然所有的消费者都会更新
                        changedBits = isFn(calculateChangedBits) ? calculateChangedBits(oldValue, newValue) : MAX_NUMBER;
                        // 向下取整
                        changedBits |= 0;
                        if (changedBits !== 0) {
                            instance.subscribers.forEach(function(fiber) {
                                if (fiber.setState) {
                                    fiber.setState({value: newValue});
                                    fiber = get(fiber);
                                }
                                // TODO: 这个 updateComponent 还不清除啥时候加进去的
                                Renderer.updateComponent(fiber, true);
                            })
                        }
                    }
                }
            },
            render: function render() {
                return this.props.children;
            }
        }
    )

    var Consumer = miniCreateClass(
        function Consumer() {
            instance.subscribers.push(this);
            // QUESTION: 这里暂时还没体现 observeBits 的用处，应该是 observeBits & changedBits = 0 的时候，该 Consumer 也不会更新。
            // 而且也应该是通过 props 传递进来的
            this.observeBits = 0
            this.state = { value: instance.value }
        },
        Component,
        {
            componentWillUnmount: function componentWillUnmount() {
                var i = instance.subscribers.indexOf(this);
                instance.subscribers.splice(i, 1);
            },
            render: function render() {
                // render props style
                return this.props.children(getContext(get(this)));
            }
        }
    )

    function getContext(fiber) {
        // 一层一层的往上找，直到找到 Provider
        while (fiber.return) {
            if (fiber.type === Provider) {
                return instance.value;
            }
            fiber = fiber.return;
        }
        // 如果没有提供 Provider，那么就使用 defaultValue
        return defaultValue;
    }

    getContext.subscribers = []
    getContext.Provider = Provider
    getContext.Consumer = Consumer
    return getContext
};