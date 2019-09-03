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

// 根据 $$typeof 就可以判断
export function isValidElement(vnode) {
    return !!vnode && vnode.$$typeof === REACT_ELEMENT_TYPE; 
}

// 文本节点，单独处理 => {type: '#text', tag: 6, props: 'xxx'}
export function createVText(text) {
    return ReactElement('#text', 6, text + '');
}

// Escape and wrap key so it is safe to use as a reactid
function escape(key) {
    const escapeRegex = /[=:]/g
    const escaperLookup = {
        '=': '=0',
        ':': '=2'
    }
    const escapeString = ('' + key).replace(escapeRegex, function(match) {
        return escaperLookup[match]
    })

    return '$' + escapeString;
}

// 下面两个方法是一起的
let lastText, flattenIndex, flattenObject;
function flattenCb(context, child, key, childType) {
    if (child === null) {
        lastText = null
        return
    }
    // number or string
    if (childType === 3 || childType === 4) {
        if (lastText) {
            lastText.props += child
            return
        }
        lastText = child = createVText(child)
    } else {
        lastText = null
    }

    if (!flattenObject[key]) {
        flattenObject[key] = child
    } else {
        // FIXME: 这里我怎么感觉应该是 key += '.' + flattenIndex 会比 .1 .2 .3 好点？
        key = '.' + flattenIndex
        flattenObject[key] = child
    }
    flattenIndex++;
}

// 最终的目的就是递归所有 children 的同时，把所有 child 放进一个对象，并挂载到 fiber
export function fiberizeChildren(children, fiber) {
    flattenObject = {}
    flattenIndex = 0
    if (children !== void 666) {
        lastText = null // c 为 fiber.props.children
        traverseAllChildren(children, '', flattenCb)
    }
    flattenIndex = 0
    return (fiber.children = flattenObject);
}

// 没有 key 就造一个
function getComponentKey(component, index) {
    if (typeof component === 'object' && component !== null && component.key !== null) {
        return escape(component.key)
    }
    // Implicit key determined by the index in the set
    return index.toString(36)
}

const SEPARATOR = '.'
const SUBSEPARATOR = ':'

// 类似 React.Children 中的实现，看起来很复杂，拆开看其实很简单
// 终止条件，所有的递归都要有终止条件，这里就是 invokeCallback，如果判断不是数组，其它类型都会执行这个
// 是数组的话就继续递归下去，当然，这里还考虑到来 Map, Set 等数据类型的情况
export function traverseAllChildren(children, nameSoFar, callback, bookKeeping) {
    let childType = typeNumber(children);
    let invokeCallback = false;
    switch(childType) {
        case 0: // undefined
        case 1: // null
        case 2: // boolean
        case 5: // function
        case 6: // symbol
            children = null;
            invokeCallback = true;
            break;
        case 3: // string
        case 4: // number
            invokeCallback = true;
            break;
        // 7 array
        case 8: // object

            // 如果是组件实例，或者是虚拟 dom 节点
            if (children.$$typeof || children instanceof Component) {
                invokeCallback = true;
            }
            // 转字符串
            else if (children.hasOwnProperty('toString')) {
                children = children + '';
                invokeCallback = true;
                childType = 3;
            }
            break;
    }

    if (invokeCallback) {
        // flattenCb(context, children, key, childType)
        callback(bookKeeping, children, nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar, childType);
        return 1;
    }

    // count of children found in the current subtree
    let subtreeCount = 0;
    const nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;

    // 如果是数组的话，遍历处理
    if (children.forEach) {
        // 数组、Map、Set
        children.forEach(function(child, i) {
            let nextName = nextNamePrefix + getComponentKey(child, i);
            // 递归下去
            subtreeCount += traverseAllChildren(child, nextName, callback, bookKeeping)
        })
        return subtreeCount;
    }

    // 数组已经处理过了，到这一步的话，应该就是 Map 或者是 Set 结构的了，可以用迭代器处理
    const iteratorFn = getIterator(children);
    if (iteratorFn) {
        let iterator = iteratorFn.call(children),
            child,
            ii = 0,
            step,
            nextName;

        while (!(step = iterator.next()).done) {
            child = step.value;
            nextName = nextNamePrefix + getComponentKey(child, ii++);
            subtreeCount += traverseAllChildren(child, nextName, callback, bookKeeping)
        }
        return subtreeCount
    }
    throw 'children: type is invalid.';
}

// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator
let REAL_SYMBOL = hasSymbol && Symbol['iterator'];
let FAKE_SYMBOL = '@@iterator';
function getIterator(a) {
    let iteratorFn = (REAL_SYMBOL && a[REAL_SYMBOL]) || a[FAKE_SYMBOL];
    if (iteratorFn && iteratorFn.call) {
        return iteratorFn
    }
}