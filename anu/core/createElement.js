import {
    typeNumber,
    toWarnDev,
    hasSymbol,
    REACT_ELEMENT_TYPE,
    hasOwnProperty
} from './util';
import { Renderer } from './createRenderer';
import { Component } from './Component';

// 一些保留属性， TODO: 具体的含义会后续补充
const RESERVED_PROPS = {
    key: true,
    ref: true,
    __self: true,
    __source: true
}

// 参数的含义可以看看下面的 createElement 就明白了
function makeProps(type, config, props, children, len) {
    // Remaining properties override existing props
    // 看这里就知道 props 刚开始一定会赋值为 {}
    let defaultProps, propName;
    for (propName in config) {
        if (
            hasOwnProperty.call(config, propName) &&
            !RESERVED_PROPS.hasOwnProperty(propName)
        )
        props[propName] = config[propName]
    }

    // defaulProps 是静态属性 -- static defaultPropr = {} --
    if (type && type.defaultProps) {
        defaultProps = type.defaultProps;
        for (propName in defaultProps) {
            // 什么叫默认值，就是没有赋予具体值的时候就用默认值填充啊
            if (props[propName] === undefined) {
                props[propName] = defaultProps[propName]
            }
        }
    }

    if (len === 1) props.children = children[0]
    else if (len > 1) props.children = children

    return props;
}

function hasValidRef(config) {
    return config.ref !== undefined
}

function hasValidKey(config) {
    return config.key !== undefined
}

// 虚拟 dom 工厂
export function createElement(type, config, ...children) {
    let props = {},
        tag = 5, // TODO: ????
        key = null,
        ref = null,
        argsLen = children.length;

    // 如果是组件 -> 进一步区分为 class component and function component
    if (type && type.call) {
        tag = type.prototype && type.prototype.render ? 2 : 1;
    }
    else if (type + '' !== type) {
        toWarnDev('React.createElement: type is invalid.');
    }

    if (config != null) {
        if (hasValidRef(config)) ref = config.ref;
        if (hasValidKey(config)) key = '' + config.key;
    }

    props = makeProps(type, config || {}, props, children, argsLen);

    return ReactElement(type, tag, props, key, ref, Renderer.currentOwner);
}