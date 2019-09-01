import { toWarnDev, returnFalse, returnTrue, get } from "./utils";
import { Renderer } from "./createRenderer";

export const fakeObject = {
    enqueueSetState: returnFalse,
    isMounted: returnFalse
};

// 组件的基类 参数 props context
export function Component(props, context) {
    // 防止用户在构造器生成JSX

    Renderer.currentOwner = this;
    this.context = context;
    this.props = props;
    this.refs = {};
    this.updater = fakeObject;
    this.state = null;
}
// NOTE: 这里需要关注一下在 Fiber 架构下的 setState 实现
Component.prototype = {
    //必须重写constructor,防止别人在子类中使用Object.getPrototypeOf时找不到正确的基类
    constructor: Component,

    replaceState() {
        toWarnDev('replaceState', true);
    },
    isReactComponent: returnTrue,
    isMounted() {
        toWarnDev('isMounted', true);
        return this.updater.isMounted(this);
    },
    setState(state, cb) {
        this.updater.enqueueSetState(get(this), state, cb)
    },
    forceUpdate() {
        this.updater.enqueueSetState(get(this), true, cb)
    },
    render() {
        throw "must implement render";
    }
}