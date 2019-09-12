# clone

> [项目地址](https://github.com/pvorb/clone)
>
> 项目作者：[pvorb](https://github.com/pvorb)



```javascript
var clone = (function() {
'use strict';

function _instanceof(obj, type) {
  return type != null && obj instanceof type;
}

var nativeMap;
try {
  nativeMap = Map;
} catch(_) {
  // maybe a reference error because no `Map`. Give it a dummy value that no
  // value will ever be an instanceof.
  nativeMap = function() {};
}

var nativeSet;
try {
  nativeSet = Set;
} catch(_) {
  nativeSet = function() {};
}

var nativePromise;
try {
  nativePromise = Promise;
} catch(_) {
  nativePromise = function() {};
}

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
 * @param `includeNonEnumerable` - set to true if the non-enumerable properties
 *    should be cloned as well. Non-enumerable properties on the prototype
 *    chain will be ignored. (optional - false by default)
*/
// 我们看看考虑到了啥：1. 循环引用问题 2. 控制克隆层级 3. 可选的原型 4. 不可枚举属性也支持被克隆
function clone(parent, circular, depth, prototype, includeNonEnumerable) {
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    includeNonEnumerable = circular.includeNonEnumerable;
    circular = circular.circular;
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  // 用两个数组来解决循环引用的问题
  // 每次迭代的对象引用都存进 parents 数组，如果下一次发现了同引用，那就是循环引用了
  // 就返回 children 中存的数据
  var allParents = [];
  var allChildren = [];

  // Buffer 类型
  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    // 🚩1: 如果克隆目标是 null，直接返回 null
    if (parent === null)
      return null;
    // 如果设置层级为0 ，那就直接返回目标对象指针或数据（基本类型），表示不克隆
    if (depth === 0)
      return parent;

    var child;
    var proto;
    // 目标不是对象类型也直接返回
    if (typeof parent != 'object') {
      return parent;
    }
    // 🚩2: 如果克隆目标是 Map，child 等于新的 Map 实例
    if (_instanceof(parent, nativeMap)) {
      child = new nativeMap();
      // 🚩3: 如果克隆目标是 Set，child 等于新的 Set 实例
    } else if (_instanceof(parent, nativeSet)) {
      child = new nativeSet();
      // 🚩4: 如果克隆目标是 Promise，child 等于新的 Promise 实例
    } else if (_instanceof(parent, nativePromise)) {
      child = new nativePromise(function (resolve, reject) {
          // 新的 promise 实例 resolve 的是一个深度克隆的 value,
          // 如果这个 value 还是 promise，就会继续 new Promise。继续克隆其 value
        parent.then(function(value) {
          resolve(_clone(value, depth - 1));
        }, function(err) {
          reject(_clone(err, depth - 1));
        });
      });
      // 🚩5: 如果克隆目标是 Array，child 等于新的数组
    } else if (clone.__isArray(parent)) {
      child = [];
      // 🚩6: 如果克隆目标是 RegExp，child 等于新的 RegExp 实例
      // notice!!: ---> new RegExp(source, flagsString) & lastIndex
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      // 结构化拷贝是不支持这个的拷贝的
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
      // 🚩7: 如果克隆目标是 Date，child 等于新的 Date 实例
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
      // 🚩8: 如果克隆目标是 Buffer
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      if (Buffer.from) {
        // Node.js >= 5.10.0
        child = Buffer.from(parent);
      } else {
        // Older Node.js versions
        child = new Buffer(parent.length);
        parent.copy(child);
      }
      return child;
      // 🚩9: 如果克隆目标是 Buffer，这个也是结构化克隆算法不支持的
    } else if (_instanceof(parent, Error)) {
        // 这里就是原型继承
      child = Object.create(parent);
      // 🚩10: 其他类型，比如 function?
    } else {
        // 如果没传入 prototype 就用目标值的
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    // 🔥 解决循环引用的问题
    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    // Map 处理整个一层的数据
    if (_instanceof(parent, nativeMap)) {
      parent.forEach(function(value, key) {
        var keyChild = _clone(key, depth - 1);
        var valueChild = _clone(value, depth - 1);
        child.set(keyChild, valueChild);
      });
    }
    // Set 处理整个一层的数据
    if (_instanceof(parent, nativeSet)) {
      parent.forEach(function(value) {
        var entryChild = _clone(value, depth - 1);
        child.add(entryChild);
      });
    }
    // Obj 处理整个一层的数据
    for (var i in parent) {
      var attrs = Object.getOwnPropertyDescriptor(parent, i);
      if (attrs) {
        child[i] = _clone(parent[i], depth - 1);
      }

      // 这里就是加一层保险，没有 setter 的时候不能被克隆，因为不能被赋值
      try {
        var objProperty = Object.getOwnPropertyDescriptor(parent, i);
        if (objProperty.set === 'undefined') {
          // no setter defined. Skip cloning this property
          continue;
        }
        child[i] = _clone(parent[i], depth - 1);
      } catch(e){
        if (e instanceof TypeError) {
          // when in strict mode, TypeError will be thrown if child[i] property only has a getter
          // we can't do anything about this, other than inform the user that this property cannot be set.
          continue
        } else if (e instanceof ReferenceError) {
          //this may happen in non strict mode
          continue
        }
      }

    }

    // 🚩11: Symbol 类型
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(parent);
      for (var i = 0; i < symbols.length; i++) {
        // Don't need to worry about cloning a symbol because it is a primitive,
        // like a number or string.
        var symbol = symbols[i];
        var descriptor = Object.getOwnPropertyDescriptor(parent, symbol);
        if (descriptor && !descriptor.enumerable && !includeNonEnumerable) {
          continue;
        }
        child[symbol] = _clone(parent[symbol], depth - 1);
        Object.defineProperty(child, symbol, descriptor);
      }
    }

    // 如果需要克隆不可枚举的类型
    if (includeNonEnumerable) {
      // 返回一个由指定对象的所有自身属性的属性名（包括不可枚举属性但不包括Symbol值作为名称的属性）组成的数组
      var allPropertyNames = Object.getOwnPropertyNames(parent);
      for (var i = 0; i < allPropertyNames.length; i++) {
        var propertyName = allPropertyNames[i];
        var descriptor = Object.getOwnPropertyDescriptor(parent, propertyName);
        // 可枚举的就跳过了 之前已经处理了
        if (descriptor && descriptor.enumerable) {
          continue;
        }
        child[propertyName] = _clone(parent[propertyName], depth - 1);
        Object.defineProperty(child, propertyName, descriptor);
      }
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
}
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
}
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
}
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
}
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
}
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

```