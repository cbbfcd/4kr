import {
    typeNumber,
    toWarnDev,
    hasSymbol,
    REACT_ELEMENT_TYPE,
    hasOwnProperty
} from './utils';
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
        tag = 5,
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

export function cloneElement(element, config, ...children) {
    // Original props are copied
    let props = Object.assign({}, element.props);

    // Reserved names are extracted
    let type = element.type
    let key = element.key
    let ref = element.ref
    let tag = element.tag

    // Owner will be preserved, unless ref is overridden
    let owner = element._owner;
    let argsLen = children.length;
    if (config != null) {
        if (hasValidRef(config)) {
            ref = config.ref;
            // NOTE: 偷个爹
            owner = Renderer.currentOwner
        }
        if (hasValidKey(config)) key = '' + config.key
    }

    props = makeProps(type, config || {}, props, children, argsLen)

    return ReactElement(type, tag, props, key, ref, owner)
}

// 工厂函数的作用就是方便建立同类型元素
export function createFactory(type) {
    var factory = createElement.bind(null, type);
    factory.type = type
    return factory
}

/*
tag的值
FunctionComponent = 1;
ClassComponent = 2;
HostPortal = 4; 
HostComponent = 5;
HostText = 6;
Fragment = 7;
*/
function ReactElement(type, tag, props, key, ref, owner) {
    var ret = {
        type,
        tag,
        props
    }

    if (tag !== 6) {
        ret.$$typeof = REACT_ELEMENT_TYPE
        ret.key = key || null
        let refType = typeNumber(ref);

        // boolean, number, string, function, object
        if (
            refType === 2 ||
            refType === 3 ||
            refType === 4 ||
            refType === 5 ||
            refType === 8
        ) {
            if (refType < 4) {
                ref += ''
            }

            ret.ref = ref;
        } else {
            ret.ref = null
        }

        ret._owner = owner
    }

    return ret;
}

