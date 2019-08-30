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

export let __type = Object.prototype.toString;

// 获取 window 
var fakeWindow = {};
export function getWindow() {
    try {
        if (window) return window;
    } catch (error) {
        try {
            if (global) return global;
        } catch (error) {}
    }
    return fakeWindow;
}

// 判断是不是已挂载，就是判断有没有 fiber 实例，且实例上挂了 hasMounted 
export function isMounted(instance) {
    var fiber = get(instance);
    return !!(fiber && fiber.hasMounted);
}

// 生产环境下抛出提示
export function toWranDev(msg, deprecated) {
    msg = deprecated ? msg + ' is deprecated' : msg;
    let process = getWindow().process;
    if (process && process.env.NODE_ENV === 'development') {
        throw msg;
    }
}

// object.assign shim
export function extend(obj, props) {
    for (let i in props) {
        if (hasOwnProperty.call(props, i)) {
            obj[i] = props[i]
        }
    }
    return obj;
}

// 继承 -- 典型的寄生组合继承
// https://codesandbox.io/s/kknnwvw765
export function inherit(SubClass, SupClass) {
    function Bridge() {}
    let orig = SubClass.prototype;
    // SubClass.prototype = Object.create(SupClass.prototype)
    Bridge.prototype = SupClass.prototype;
    let fn = (SubClass.prototype = new Bridge())
    // 避免原型链拉长导致方法查找的性能开销
    extend(fn, orig)
    fn.constructor = SubClass;
    return fn;
}

// ----------------------- 支持多重继承的实现，当然 JS 是不支持多重继承的，只是顺着原型链继续委托 ------------------------
const _inherit = (Sub, Sup) => {
    const object_proto = Object.prototype,
        sub_proto = Sub.prototype,
        sup_proto = Object.create(Sup.prototype);

    // 说明没继承过其他类
    if (Object.getPrototypeOf(sub_proto) === object_proto) {
        // 这里 extend 的原因是原来的原型被覆盖后，导致了查询开销
        Sub.prototype = extend(sup_proto, Sub.prototype);
        Sub.prototype.constructor = Sub;
    } else {
        // 必须找到正确的 constructor
        let constructor;
        while (Object.getPrototypeOf(sub_proto) !== object_proto) {
            sub_proto = Object.getPrototypeOf(sub_proto);
            constructor = sub_proto.constructor;
        }
        Object.setPrototypeOf(sub_proto, Sup.prototype);
        sub_proto.constructor = constructor;
    }
}
// -------------------------------------------------------------------------------------------------------------

// 对小程序的特性检测
try {
    //微信小程序不支持Function
    var supportEval = Function('a', 'return a + 1')(2) == 3;
} catch (error) {}

// 创建一个类
let rname = /function\s+(\w+)/;
export function miniCreateClass(ctor, superClass, methods, statics) {
    // 取名字
    let className = ctor.name || (ctor.toString().math(rname) || ['', 'Anonymous'])[1];
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function
    let Ctor = supportEval ? Function('superClass', 'ctor', 'return function' + className + '(props, context){ superClass.apply(this, arguments); ctor.apply(this, arguments) }')(superClass, ctor)
        : function ReactInstance() {
            superClass.apply(this, arguments);
            ctor.apply(this, arguments);
        };
    // 利用一个中间函数 Ctor，继承 superClass，这个 Ctor 就是 ctor 的复制版，所以要初始化去 ctor.apply，还有 mixin 进去 methods, statics 等
    Ctor.displayName = className;
    let proto = inherit(Ctor, superClass);
    extend(proto, methods);
    extend(Ctor, superClass); // 继承父类的静态成员
    if (statics) {
        // 添加自己的静态成员
        extend(Ctor, statics)
    }
    return Ctor;
}

// 加了缓存，转小写
let lowerCache = {}
export function toLowerCase(s) {
    return lowerCache[s] || (lowerCache[s] = s.toLowerCase())
}

// 判断是不是函数
export function isFn(obj) {
    return __type.call(obj) === '[object Function]'
}

let rword = /[^, ]+/g // 匹配非逗号和空格

// 转为一个对象
export function oneObject(array, val) {
    //利用字符串的特征进行优化，字符串加上一个空字符串等于自身
    if (array + '' === array) {
        array = array.math(rword) || [];    
    }
    let result = {},
        value = val !== void 666 ? val : 1;
    
    for (let i = 0, n = array.length; i < n; i++) {
        result[array[i]] = value;
    }

    return result;
}

let rcamelize = /[-_][^-_]/g; // 命名

// 转驼峰
export function camelize(target) {
    // 提前判断，提高 getStyle 等的效率
    if (!target || (target.indexOf('-') < 0 && target.indexOf('_') < 0)) {
        return target;
    }

    // 转驼峰
    // 'a-b-c'.replace(/[-_]([^-_])[^-_]*/g, (_, p1) => p1.toUpperCase());
    let str = target.replace(rcamelize, function(match) {
        return match.charAt(1).toUpperCase()
    })

    return firstLetterLower(str);
}

// 首字母小写
export function firstLetterLower(str) {
    return str.charAt(0).toLowerCase() + str.slice(1)
}

let numberMap = {
    //null undefined IE6-8这里会返回[object Object]
    '[object Boolean]': 2,
    '[object Number]': 3,
    '[object String]': 4,
    '[object Function]': 5,
    '[object Symbol]': 6,
    '[object Array]': 7
}

// undefined: 0, null: 1, boolean:2, number: 3, string: 4, function: 5, symbol:6, array: 7, object:8
export function typeNumber(data) {
    if (data === null) return 1;
    if (data === void 666) return 0;

    let a = numberMap[__type.call(data)]

    return a || 8
}

export let toArray = Array.from || function(a) {
    let ret = []
    for (let i = 0, n = a.length; i < n; i++) {
        ret[i] = a[i]
    }
    return ret;
}


