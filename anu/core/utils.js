// 这个模块包含了定义的工具函数，部分会详细解读，简单的直接略过啦

export const arrayPush = Array.prototype.push;
export const innerHTML = 'dangerouslySetInnerHTML';
export const hasOwnProperty = Object.property.hasOwnProperty;
export const gSBU = 'getSnapshotBeforeUpdate';
export const gDSFP = 'getDerivedStateFromProps';
export const hasSymbol = typeof Symbol === 'function' && Symbol['for'];
export const effects = [];
export const topFibers = [];
export const topNodes = [];
export const emptyArray = [];
export const emptyObject = {};

// https://github.com/facebook/react/blob/master/packages/shared/ReactSymbols.js#L14
// 首选使用 Symbol，不然选择 16 进制的掩码，当然 Symbol 才是其目的，为了应对 JSON 的安全问题
// 因为 JSON 不支持 Symbol，所以检测 $$type 可以做一层拦截
// https://overreacted.io/zh-hans/why-do-react-elements-have-typeof-property/
export const REACT_ELEMENT_TYPE = hasSymbol ? Symbol['for']('react.element') : 0xeac7;

export function noop() {};

// 所以使用 Fragment 会少一层嵌套嘛
export function Fragment(props) { return props.children; }

export function returnFalse() { return false; }
export function returnTrue() { return true; }

// 重置栈，只留最后一个
export function resetStack(info) {
    keepLast(info.containerStack);
    keepLast(info.contextStack);
}

// 这个方法的意思就是只保留数组最后一项： var l = [1, 2, 3] -> keepLast(l) -> [3]
function keepLast(list) {
    var n = list.length;
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    list.splice(0, n - 1);
}

// 内置的 _reactInternalFiber 属性指向它对应的 Fiber 实例
// 这个属性在 react 中是挂在 组件实例 上的
export function get(key) {
    return key._reactInternalFiber;
}