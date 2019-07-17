# on-change

> [项目地址](https://github.com/sindresorhus/on-change)
>
> 项目作者：[sindresorhus](https://github.com/sindresorhus)



## About

> 这是一个针对观察对象或数组的变化的项目，主要使用了 `Proxy`。

```javascript
// 下边展示了如何使用
const onChange = require('on-change');

const object = {
	foo: false,
	a: {
		b: [
			{
				c: false
			}
		]
	}
};

let i = 0;
const watchedObject = onChange(object, function (path, value, previousValue) {
	console.log('Object changed:', ++i);
	console.log('this:', this);
	console.log('path:', path);
	console.log('value:', value);
	console.log('previousValue:', previousValue);
});

watchedObject.foo = true;
//=> 'Object changed: 1'
//=> 'this: {
//   	foo: true,
//   	a: {
//   		b: [
//   			{
//   				c: false
//   			}
//   		]
//   	}
//   }'
//=> 'path: "foo"'
//=> 'value: true'
//=> 'previousValue: false'

watchedObject.a.b[0].c = true;
//=> 'Object changed: 2'
//=> 'this: {
//   	foo: true,
//   	a: {
//   		b: [
//   			{
//   				c: true
//   			}
//   		]
//   	}
//   }'
//=> 'path: "a.b.0.c"'
//=> 'value: true'
//=> 'previousValue: false'
```

更多可参考其 `README` 文档。



##  Plot

我们从最初的版本开始，沿着作者和贡献者的思路完善下去：

**v0.1.0**

```javascript
'use strict';

module.exports = (object, onChange) => {
	const handler = {
		get(target, property, receiver) {
			try {
				return new Proxy(target[property], handler);
			} catch (err) {
				return Reflect.get(target, property, receiver);
			}
		},
		defineProperty(target, property, descriptor) {
			onChange();
			return Reflect.defineProperty(target, property, descriptor);
		},
		deleteProperty(target, property) {
			onChange();
			return Reflect.deleteProperty(target, property);
		}
	};

	return new Proxy(object, handler);
};
```

最初的版本很简单，就是通过  [Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy) 进行属性的拦截，这里注意的点就是：

* `getter` 中每次只返回第一级的 `property`，比如 `proxy.a.b` 获取到的 `property` 只有 `a`。

为了获取到每一级的属性，作者每次返回了新的 `Proxy`，`demo` 如下：

```javascript
const sum = {a : {b: {c: [1]}}}

const handler = {
  get(target, property, receiver) {
			try {
        console.log('->', property);
				return new Proxy(target[property], handler);
			} catch (err) {
				return Reflect.get(target, property, receiver);
			}
		},
};

var proxy1 = new Proxy(sum, handler);

proxy1.a.b.c[0]
// -> a
// -> b
// -> c
// -> 0
```

这也是一个很常见的技巧，就是如何去追踪深层次的对象属性。

* 既然是追踪变化，就需要关注赋值，所以这里作者在 `defineProperty`，`deleteProperty` 中触发了事件。

这里其实也暴露出了一些问题，比如：多次执行的问题，如果没改变值不应该触发事件等。

*关于多次触发的 `demo`*:

```javascript
const sum = {a : {b: {c: [1, 2, 3]}}}

const handler = {
  get(target, property, receiver) {
    try {
      return new Proxy(target[property], handler);
    } catch (err) {
      return Reflect.get(target, property, receiver);
    }
  },
  defineProperty(target, property, descriptor) {
    console.log('property is', property, 'changed options from:', target[property], 'to', descriptor.value);
    return Reflect.defineProperty(target, property, descriptor);
  },
};

var proxy1 = new Proxy(sum, handler);

proxy1.a.b.c.push(4);

// 输出
// "property is" "3" "changed options from:" undefined "to" 4
// "property is" "length" "changed options from:" 4 "to" 4
```

类似的数组操作还有 `unshift`，`pop`，`reverse` 等，都会多次触发。原因是要多一个 `length` 计算，或者是排序的时候的移动等。

后续的版本中加入了 `set` 的处理，这里我做了一些实验，发现赋值类型操作其实还是会触发 `defineProperty`，但是如果 `set` 也存在的话就不会触发了。但是执行 `Object.defineProperty` 操作则只会触发 `defineProperty`，不会触发 `set`：

```javascript
const sum = {a : {b: {c: []}}}
const handleChange = (msg = 'setter invoked!') => {
  console.log(msg);
}
const handler = {
  get(target, property, receiver) {
    try {
      return new Proxy(target[property], handler);
    } catch (err) {
      return Reflect.get(target, property, receiver);
    }
  },
  set(target, property, value, r) {
    const previous = Reflect.get(target, property, value, r);
	  const result = Reflect.set(target, property, value);
    if (previous !== value) handleChange();
    return result
  },
  defineProperty(target, property, descriptor) {
    const result = Reflect.defineProperty(target, property, descriptor);
	  handleChange('defineProperty invoked!');
    return result;
  }
};

var proxy1 = new Proxy(sum, handler);

// Object.defineProperty 只会触发 defineProperty，不会触发 set
// Object.defineProperty(proxy1, 'a', {value: 5});

// 若 defineProperty 和 set 同时存在，触发 set
// 若 只有 defineProperty，没有 set，则触发 defineProperty
// proxy1.a.b.c.push(5);

// 同上
proxy1.a.b.c = 5;
// 输出 setter invoked!
```

我是这么理解的，在规范中定义了两种都可以改变对象某属性对应的值的方式，一个称做*定义*，一个称做*赋值*，分别对应 `Object.defineProperty` 和 `=`。

其中*定义*的底层操作是 `[[DefineOwnProperty]]` 赋值则是 `[[Put]]`，但是最终 `[[Put]]` 操作还是调用的 `[[DefineOwnProperty]]` 完成对应值及描述的改变，所以 `set` 没定义的时候， `defineProperty` 还是会被触发。二者都在的时候只触发 `set`，毕竟` [[Put]]` 并不是 `[[DefineOwnProperty]]`。

**v0.2.0**

这个版本主要解决了上面提到的多次执行的问题，方式很粗暴（大概思路如下）：

```javascript
// 注意：demo 通过 console.log 模拟 onChange 回调函数
const sum = {a : {b: {c: [1, 2, 3]}}}
// 所有的数组操作，这里只列举部分
const blocklist = ['sort', 'pop'];
// 锁
let block = false;
const handler = {
  get(target, property, receiver) {
    try {
      return new Proxy(target[property], handler);
    } catch (err) {
      return Reflect.get(target, property, receiver);
    }
  },
  defineProperty(target, property, descriptor) {
    // 被锁住后就不会执行了
    if (!block) {
      console.log('property is', property, 'changed options from:', target[property], 'to', descriptor.value);
    }
    return Reflect.defineProperty(target, property, descriptor);
  },
  apply(target, ctx, args) {
    // 如果命中数组操作，加锁
  	if (blocklist.includes(target.name)) {
      block = true;
      const res = Reflect.apply(target, ctx, args);
      console.log('function name is:', target.name, 'args are:', args);
      block = false;
      return res;
    }
    return Reflect.apply(target, ctx, args);
  }
};

var proxy1 = new Proxy(sum, handler);

proxy1.a.b.c.sort();

// 输出
// "function name is:" "sort" "args are:" Array []
```

其思路很简单，通过 `apply` 去拦截方法，然后判断是不是数组操作方法，如果是的话通过加锁让 `defineProperty` 中的事件不被触发，这样就会只执行一次了。

**v1.0.0**

这个版本有一些很酷的改变，这里有一个 [PR](https://github.com/sindresorhus/on-change/pull/16)，非常的有意思，也是这个版本中几乎所有的改变。

点击[这里](https://github.com/sindresorhus/on-change/pull/16/files#diff-1)，可以清楚的看到贡献者的思路，做了如下改变：

- 通过 `isPrimitive` 的判断，去除掉了原来 `getter`  中的 `try...catch...`
- 使用 `WeakMap` 缓存了对象的 `descriptor`，并在 `getter` 中对 `invariants` 进行处理，参考 [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/get#Invariants)，该缓存在赋值操作中被清理，从而进入循环利用。
- 采用了一种更巧妙的方式解决多次执行的问题

*下面展示了其如何解决多次执行的问题*：

```javascript
const sum = {a : {b: {c: [1, 2, 3]}}}
let inApply = false, changed = false;
const handleChange = () => {
  if (!inApply) console.log('invoked!')
  else if (!changed) changed = true
}
const handler = {
  get(target, property, receiver) {
    try {
      return new Proxy(target[property], handler);
    } catch (err) {
      return Reflect.get(target, property, receiver);
    }
  },
  set(target, property, value, r) {
    const previous = Reflect.get(target, property, value, r);
	  const result = Reflect.set(target, property, value);
    if (previous !== value) handleChange();
    return result
  },
  defineProperty(target, property, descriptor) {
    const result = Reflect.defineProperty(target, property, descriptor);
	  handleChange();
    return result;
  },
  apply(target, ctx, args) {
  	if (!inApply) {
      inApply = true;
      // apply 执行后，如果有 set 操作就会进行 set 的流程
      const res = Reflect.apply(target, ctx, args);
      if (changed) console.log('invoked!');
      inApply = false;
      changed = false;
      return res;
    }
    return Reflect.apply(target, ctx, args);
  }
};

var proxy1 = new Proxy(sum, handler);

proxy1.a.b.c.push(4);

// 输出
// invoked!
```

觉得有点绕的话可以参考下边这个流程图（少了一条关键线路，发现了吗）：

![on-change-01](/Users/huangteng01/learn/4kr/imgs/on-change-01.png)

通过两个锁来控制其执行流程，达到过滤多次函数触发的根本原因在于代理中的这些 `traps` 具有同步性，好比你执行 `a.b.c.push()`，这个操作会触发 `apply` （这里先不管 `get`），然后 `push` 操作会触发 `set` 的执行，这个时候没有改变，所以最终 `onChange` 不会触发，但是如果你执行 `a.b.c.push(1)`，同样进入 `apply` 之后，加锁，然后执行 `set`，这个时候 `previous !== value`，所以设置 `changed = true`，回到 `apply` 中，因为 `changed` 为真，所以会触发 `onChange`。

- 这次 `PR` 中最有意思的点就是加入了 `const proxyTarget = Symbol('ProxyTarget')`，具体什么作用呢，可以参考其 `PR` 中的评论

> There is [no direct way](https://stackoverflow.com/questions/51096547/how-to-get-the-target-of-a-javascript-proxy) to retrieve the `target` of a Proxy object (nor is it even possible to determine if an object is in fact a Proxy). The `proxyTarget` attribute is a workaround to determine if the `value`passed to the `set` trap is a proxied value produced by a previous call to `get`. This allows us to "un-proxy" the value before setting it on the underlying target. The benefit of this is that a program can continue to use the raw object it passed to `onChange` to safely bypass change detection, even on descendant properties.

*关键代码*

```javascript
{
  get(target, prop, r) {
    if (prop === proxyTarget) return target;
  },
  set(target, property, value, receiver) {
    if (value && value[proxyTarget] !== void 0) value = value[proxyTarget];
  }
}
```

首先加上一个 `proxyTarget` 的目的是为了可以通过一种变通的方式可以获取传入的原始对象 `target`，而不是 `proxy object`。

为什么要这么做呢？因为我们不能确定 `set` 中的 `value` 是不是上一次 `get` 返回的代理对象。

比如：

根据 `get` 实现，可知对于  `const raw = {a: {b: {c: 'name'}}}`，那么执行 。

```javascript
const onChange = require('on-change');
// 原始数据
const prev = raw.a.b;
// 根据 getter 实现，返回的是一个代理。
const obj = onChange(raw, () => {});
// 如果不处理的话，一个 proxy 对象将被代理到 raw.a.b
obj.a.b = obj.a.b;
// so ???
prev === raw.a.b;
```

这个时候回过去看上面展示的核心代码，甚是巧妙：

*若传给 `set` 的 `value` 是一个 `raw obj` 那么 `value[proxyTarget]` 不会触发 `get` 并且等于 `undefined`，如果传入的是一个 `proxy obj`，那么会触发 `get` 返回的是 `target` 也就是原始对象了！*

这里也体现了 `traps` 的同步性。

**v1.1.0**

这个版本加入的改变是在 `get` 中处理了 `constructor`。

```javascript
if (isPrimitive(value) || property === 'constructor') {
  return value;
}
```

目的是为了返回原始的构造函数。

**v1.2.0**

这个版本丰富了 `onChange` 回调函数的参数，提供了 `path`，`value`，`previous` 作为参数。

```javascript
pathCache.set(value, concatPath(pathCache.get(target), property));
```

**v1.3.0**

这个版本就是在函数中增加了配置的功能，提供了 `options` 参数挂载一些配置项。

并且贡献者提供了 `isShallow` 的配置，并完善了 `benchmark` 。

就是配置了 `isShallow = true`  的时候，不会嵌套的返回 `proxy`了。

```javascript
get() {
  if (isPrimitive(value) || property === 'constructor' || options.isShallow === true) {
    return value;
  }
}
```

**v1.4.0**

这个版本改动好像还挺大的，有如下改变。

- 增加了 `proxyCache` 来缓存 `proxy`，提供性能。
- 不要对 `RegExp` 和 `Number` 对象进行代理，我在 `MDN` 上没找到相关描述，但是试试发现确实有坑。
- 解决[日期问题](https://github.com/sindresorhus/on-change/issues/25)，这个问题也是很常见的问题，网上一堆解决方案。
- *针对数组的 `callback` 参数进行了优化*。

当然这个 `PR` 对日期的处理并不是完美解决所有问题，但是调用日期对象的方法肯定是不报错了，因为内部转成了原始日期对象：

```javascript
apply(target, ctx, args) {
  if (ctx instanceof Date) {
    // 还记得这个 Symbol 吗
    ctx = ctx[proxyTarget];
  }
}
```

一个很重要的优化就是之前的版本在处理类似 `someArray.push(xx)` 这样的调用的时候，按照上面的流程图可以看出，最终是在 `apply` 中直接调用了 `onChange` 回调，但是没有传入参数，这个版本修复了这个问题。

在 `apply(target, thisArg, argumentsList)`  中是无法直接获取 `path`， `previous`， `value` 中的 `previous` 参数，所以定义了一个共享变量 `applyPrevious` 用来存这个数据。

```javascript
apply(target, thisArg, argumentsList) {
  if (!inApply) {
    inApply = true;
    // 若 a.b.c 是数组或者对象，则保留其原始 previous 值到共享变量中。
    if (
      Array.isArray(thisArg)
      || Object.prototype.toString.call(thisArg) === '[object Object]'
    ) {
      applyPrevious = shallowClone(thisArg[proxyTarget]);
    }
    applyPath = pathCache.get(target);
    applyPath = applyPath.slice(0, Math.max(applyPath.lastIndexOf(PATH_SEPARATOR), 0));
    const result = Reflect.apply(target, thisArg, argumentsList);
    inApply = false;
    if (changed || (compare && applyPrevious !== thisArg.valueOf())) {
      handleChange(applyPath, '', applyPrevious, thisArg);
      applyPrevious = null;
      changed = false;
    }
    return result;
  }
  return Reflect.apply(target, thisArg, argumentsList);
}
```

**v1.5.0**

目前最新版本，在 `v1.4.0` 的基础上改动了一点点：

- 始终在 `apply` 中移除方法名，从而获取干净的 `path`
- 支持嵌套的 `proxied objects`，其实就是把 `proxyTarget` 挪到方法里面
- 支持对象自身 `mutate`

[具体的改变见这里](https://github.com/sindresorhus/on-change/commits/v1.5.0/index.js)。其它都是些小改动，就不赘述了。

*会持续追踪该库的进展。*

## Refer

- [Proxy MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)