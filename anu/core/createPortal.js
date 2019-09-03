import { createElement } from "./createElement";

// https://zh-hans.reactjs.org/docs/portals.html
export function AnuPortal(props) {
    return props.children;
}

// 这里只是做了一层包装，返回了挂了特点属性的虚拟 DOM 对象，所以真正让 children 穿越的能力应该是在 ReactDom 中完成的
export function createPortal(children, parent) {
    let child = createElement(AnuPortal, { children, parent });
    child.isPortal = true;
    return child;
}