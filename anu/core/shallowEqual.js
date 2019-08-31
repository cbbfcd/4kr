import { typeNumber, hasOwnProperty } from './utils'

// 浅比较的方法
export function shallowEqual(objA, objB) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/is
    if (Object.is(objA, objB)) return true;

    // 确保 objA, objB 都是对象
    if (typeNumber(objA) < 7 || typeNumber(objB) < 7) {
        return false;
    }

    let keysA = Object.keys(objA)
    let keysB = Object.keys(objB)

    // keys 的长度要一致，并且对应的 value 也要一致才是相等的对象
    // 数组也可以走这一套流程进行判断的
    if (keysA.length !== keysB.length) return false;

    // Test for A's keys different from B.
    for (let i = 0, len = keysA.length; i < len; i++) {
        if (
            !Object.is(objA[keysA[i]], objB[keysB[i]]) ||
            !hasOwnProperty.call(objB, keysA[i])
        )
        return false;
    }

    return true;
}

// Object.is 的 polyfill 设计挺巧妙的，粘贴在这里学习一下
if (!Object.is) {
    Object.is = function(x, y) {
        // SameValue algorithm
        if (x === y) { // Steps 1-5, 7-10
            // Steps 6.b-6.e: +0 != -0
            return x !== 0 || 1 / x === 1 / y;
        } else {
            // Step 6.a: NaN == NaN
            return x !== x && y !== y;
        }
    };
}