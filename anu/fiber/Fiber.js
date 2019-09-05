import { extend } from "react-core/util";

// 这就是 Fiber 的组件
export function Fiber(vnode) {
    extend(this, vnode);
    // TODO: 这里怎么和 react-hot-loader 扯上了
    let type = vnode.type || 'ProxyComponent(react-hot-loader)';
    this.name = type.displayName || type.name || type;
    // TODO: 基于质数相除的任务系统
    this.effectTag = 1;
}