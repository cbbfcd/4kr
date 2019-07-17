# slow-json-stringify

> [项目地址](https://github.com/lucagez/slow-json-stringify)
>
> 作者: [Luca Gesmundo](https://github.com/lucagez)



# About

首先我们先看看这个库是怎么使用的，可能通过其使用方式可以推测其实现原理：

```javascript
const { sjs } = require('slow-json-stringify');

// 定义一个 schema，然后作为参数执行，返回一个函数
// 若表示数组可以用 ['array-simple'] 或者嵌套 sjs 函数
const stringify = sjs({
  a: 'string',
  b: 'number',
  c: 'boolean',
  d: ['array-simple'],
  e: [sjs({name: 'string'})]
});

// 再用这个函数去 stringify 目标对象
stringify({
  a: 'world',
  b: 42,
  c: true,
  d: [1, true],
  e: [{name: 'tom'}]
});

// {"a":"world","b":42,"c":true, "d":[1, true], "e": [{"name":"tom"}]}
```

虽然名字是 `slow`，但是实际上性能强悍的飞起🚀：

![slow-benchmark.png](https://user-gold-cdn.xitu.io/2019/6/5/16b25784d49d825a?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

# Plot

其实为什么 `JSON.stringify` 会慢那么多呢？

我们可以从规范中窥见一斑，慢其实就说明了其实现过程中经历了很多很多的计算步骤，复杂的过程是导致其性能低下的根本原因：

>These are the steps in stringifying an object:
>
>1. Let *stack* be an empty [List](https://www.ecma-international.org/ecma-262/5.1/#sec-8.8).
>2. Let *indent* be the empty String.
>3. Let *PropertyList* and *ReplacerFunction* be **undefined**.
>4. If Type(replacer) is Object, then
>   1. If IsCallable(replacer) is true, then
>      1. Let *ReplacerFunction* be *replacer*.
>   2. Else if the [[Class]] internal property of replacer is `Array`, then
>      1. Let *PropertyList* be an empty internal [List](https://www.ecma-international.org/ecma-262/5.1/#sec-8.8)
>      2. For each value v of a property of replacer that has an array index property name. The properties are enumerated in the ascending array index order of their names.
>         1. Let *item* be **undefined**.
>         2. If [Type](https://www.ecma-international.org/ecma-262/5.1/#sec-8)(*v*) is String then let *item* be *v.*
>         3. Else if [Type](https://www.ecma-international.org/ecma-262/5.1/#sec-8)(*v*) is Number then let *item* be [ToString](https://www.ecma-international.org/ecma-262/5.1/#sec-9.8)(*v*).
>         4. Else if Type(v) is Object then,
>            1. If the [[Class]] internal property of *v* is `"String"` or `"Number"` then let *item* be [ToString](https://www.ecma-international.org/ecma-262/5.1/#sec-9.8)(*v*).
>         5. If item is not undefined and item is not currently an element of PropertyList then,
>            1. Append *item* to the end of *PropertyList*.
>5. If Type(space) is Object then,
>   1. If the [[Class]] internal property of space is `Number` then,
>      1. Let *space* be [ToNumber](https://www.ecma-international.org/ecma-262/5.1/#sec-9.3)(*space*).
>   2. Else if the [[Class]] internal property of space is `String` then,
>      1. Let *space* be [ToString](https://www.ecma-international.org/ecma-262/5.1/#sec-9.8)(*space*).
>6. If Type(space) is Number
>   1. Let *space* be min(10, [ToInteger](https://www.ecma-international.org/ecma-262/5.1/#sec-9.4)(*space*)).
>   2. Set *gap* to a String containing *space* space characters. This will be the empty String if *space* is less than 1.
>7. Else ifType(space)is String
>   1. If the number of characters in *space* is 10 or less, set *gap* to *space* otherwise set *gap* to a String consisting of the first 10 characters of *space*.
>8. Else
>   1. Set *gap* to the empty String.
>9. Let *wrapper* be a new object created as if by the expression `new Object()`, where `Object` is the standard built-in constructor with that name.
>10. Call the [[DefineOwnProperty]] internal method of *wrapper* with arguments the empty String, the [Property Descriptor](https://www.ecma-international.org/ecma-262/5.1/#sec-8.10) {[[Value]]: *value*, [[Writable]]: **true**, [[Enumerable]]: **true**, [[Configurable]]: **true**}, and **false**.
>11. Return the result of calling the abstract operation *Str* with the empty String and *wrapper*.

这只是截取的主要实现过程，还有一些具体的实现细节没有引用，所以可见原生的 `JSON.stringify` 背后有一个复杂的实现过程，性能自然也就低下了。

**完整的规范实现细节可以点击[这里](https://www.ecma-international.org/ecma-262/5.1/#sec-15.12.3)获取。**

从规范中可以看出一些细节的地方：

* `Space` 最大只能到 `10`，小于 `1` 的话则意味着没有空格。
* 如果 `Space` 参数为字符串(字符串的前十个字母)，该字符串将被作为空格；如果该参数没有提供（或者为`null`）将没有空格。
* `Replacer` 可以是一个函数，也可以是一个数组。
* `toJson` 优先级高，可以改变最终序列化的结果。
* `undifined`，`Symbol`， `Function` 会被忽略掉，在 `replacer` 中返回 `undefined`，表示忽略该属性的序列化。
* 布尔值、数字、字符串的包装对象在序列化过程中会自动转换成对应的原始值。
* 循环引用抛出错误。
* `NaN` 和 `Infinity` 格式的数值及 `null` 都会被当做 `null`。
* 其他类型的对象，包括 `Map`/`Set`/`weakMap`/`weakSet`，仅会序列化可枚举的属性。
* ...

参见[MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)

## Optimization

对原生 `JSON.stringify` 的优化手段基本一个套路，原理都是把一些解析工作前置，最后都使用字符串拼接 `+` 属性访问（属性访问是最快的！）的套路：

1. 定义 `schema` 来表示要解析的 `target` 结构。
2. 通过 `schema` 拿到这个 `target` 所有的 `key` ，开始构造拼接函数。
3. 最终把 `target[key]` 塞进去，输出字符串。

### slow-json-stringify

作者很巧妙的设计了一些前置的解析功能，使得性能突飞猛进。

```javascript
// 定义 schema，限定了几种类型：'number','string','boolean','[arr-simple]'，嵌套 array
// 参见其文档
const schema = {
  a: 'string',
  b: 'number',
  c: 'boolean',
  d: ['array-simple'],
  e: [sjs({name: 'string'})]
}

// 这个 schema 和要序列化的对象有相同的 key 值，所以可以做一些前置的解析处理
// 1. 预解析
const _prepareString = schema => JSON.stringify(schema, (_, value) => {
  const isArray = Array.isArray(value);
  if (typeof value !== 'object' || isArray) {
    // 类型校验，不是内置的类型或者函数都会抛出异常
    _validator(value);

    if (isArray) return value;
		// 函数最终会被忽略的，其它基本类型会拼接成 `string__sjs`,`number__sjs`,[`array=simple__sjs`]
    return typeof value === 'function' ? value : `${value}__sjs`;
  }
  // 最终得到的像这样:{"a":"string__sjs","b":["array-simple__sjs"],"c":{"d":"number__sjs"}}
  return value;
});

// 接着这一步应该就处理 `string__sjs`
// 2. 用一个队列来存入每一个 key 对应的一些信息，包括 isArray, find, method 等

// 这里会用到一个有趣的工具方法，快速的找到一个对象中的某个属性对应的值
// _find(['a','b','c']) => (obj) => (((obj || {}).a || {}).b || {}).c
// 本质还是利用属性查找的速度优势，而不是递归
const _find = (path) => {
  const { length } = path;

  let str = 'obj';

  for (let i = 0; i < length; i++) {
    str = str.replace(/^/, '(');
    str += ` || {}).${path[i]}`;
  }

  return eval(`((obj) => ${str})`);
};

// 继续
const _makeQueue = (preparedSchema, originalSchema) => {
  // 两个参数依次是 _prepareString 得到的字符串再 JSON.parse 的结果和原 schema 对象。
  const queue = [];

  const allowedValues = new Set([
    'number__sjs',
    'string__sjs',
    'boolean__sjs',
  ]);
	// 递归
  (function scoped(obj, acc = []) {
    const isArray = Array.isArray(obj);
    if (allowedValues.has(obj) || isArray) {
      const usedAcc = Array.from(acc);
      // 把查值的函数也存起来，到时候直接调用就行
      const find = _find(usedAcc);

      queue.push({
        isArray,
        // 主要是针对数组，这个 method 对应的就是 array-simple 或者 函数。
        method: isArray && find(originalSchema)[0],
        find,
        name: usedAcc[usedAcc.length - 1],
      });
      return;
    }
    return Object
      .keys(obj)
      .map(prop => scoped(obj[prop], [...acc, prop]));
  })(preparedSchema);
	
  // 输出的结果：
  // [
      // {find: (obj) => (obj || {}).a, isArray: false, method: false, name: "a"},
      // {find: (obj) => (obj || {}).b, isArray: true, method: "array-simple", name: "b"},
      // {find: (obj) => ((obj || {}).c || {}).d, isArray: false, method: false, name: "d"}
  // ]
  return queue;
};

// 3. 生成 chunks 数组, 参数依次是预解析 schema 生成的 json 字符串和上一步生成的 queue.
const _makeChunks = (str, queue) => str
  .replace(/"(string__sjs|number__sjs|boolean__sjs)"|\[(.*?)\]/gm, (type) => {
    // 字符串单独处理，有个 ""
    if (type === '"string__sjs"') {
      return '"__par__"';
    }
    return '__par__';
  })
  .split('__par__')
  .map((chunk, index, chunks) => {
    // 这里利用模版字符串最后生成动态的正则表达式
    // 这一些处理其实主要解决两个问题，undefined 值的处理和最后一个值的处理。
    const matchProp = `("${(queue[index] || {}).name}":(\"?))$`;
    const matchWhenLast = `(\,?)${matchProp}`;

    const isLast = /^("}|})/.test(chunks[index + 1] || '');

    const matchPropRe = new RegExp(isLast ? matchWhenLast : matchProp);

    // 3 possibilities after arbitrary property:
    // - ", => non-last string property
    // - , => non-last non-string property
    // - " => last string property
    const matchStartRe = /^(\"\,|\,|\")/;
		
    // 返回的数据如：
    // [
      //{flag: false, pure: "{"a":"", prevUndef: "{"a":"", isUndef: "{", bothUndef: "{"},
      //{flag: false, pure: "","b":", prevUndef: ""b":", isUndef: "",", bothUndef: ""},
    // ]
    return {
      // notify that the chunk preceding the current one has not
      // its corresponding property undefined.
      // => This is a V8 optimization as it's way faster writing
      // the value of a property than writing the entire property.
      flag: false,
      pure: chunk,
      // Without initial part
      prevUndef: chunk.replace(matchStartRe, ''),
      // Without property chars
      isUndef: chunk.replace(matchPropRe, ''),
      // Only remaining chars (can be zero chars)
      bothUndef: chunk
        .replace(matchStartRe, '')
        .replace(matchPropRe, ''),
    };
  })

// 4. 生成函数返回

// 这个函数主要是处理 {a: undefined} 这种情况，在序列化的时候应该忽略的，
// 所以你看 chunks 中有 preUndef, isUndef 这些值，其实就是处理 undefined 的特例
// 这里的实现有点巧妙，但是很绕，仔细体会.
// 假设 {a: {b: undefined}} 序列化后应该为 "{"a":{}}"；b 会被忽略。
// 生成 chunks 的函数中的几个正则对应的就是不同 undefined 场景下怎么去忽略类似 b 这种无效数据
// 比如：对应的 chunks --> "{a: {b:"", 如果 b 是 undefined，使用 isUndef, 就是"{a: {"
const select = chunks => (value, index) => {
  const chunk = chunks[index];

  if (typeof value !== 'undefined') {
    // 如果上一个是 undefined
    if (chunk.flag) {
      return chunk.prevUndef + value;
    }
    // 正常情况
    return chunk.pure + value;
  }
  
  // 如果当前值是 undefined，那么下一个 chunk 的 flag 为 true
  // 这样下一个 chunk 就可以使用 preUndef，其实就是去除前边的逗号之类的
  chunks[index + 1].flag = true;

  // 如果下一个还是 undefined
  if (chunk.flag) {
    return chunk.bothUndef;
  }
  // 如果当前是 undefined
  return chunk.isUndef;
};



const sjs = (schema) => {
  const preparedString = _prepareString(schema);
  const preparedSchema = JSON.parse(preparedString);

  const queue = _makeQueue(preparedSchema, schema);
  const { length } = queue;
  const chunks = _makeChunks(preparedString, queue);
  const selectChunk = select(chunks);

  // 返回函数
  return (obj) => {
    let temp = '';

    // 遍历，拼一个字符串
    let i = 0;
    while (true) {
      if (i === length) break;
      const { method, isArray, find } = queue[i];
      const raw = find(obj);

      const ready = isArray
        ? _makeArr(raw, method)
        : raw;
      temp += selectChunk(ready, i);

      i += 1;
    }
	  // 处理最后一个 chunk
    const { flag, pure, prevUndef } = chunks[chunks.length - 1];

    return temp + (flag ? prevUndef : pure);
  };
};
```

虽然一些实现细节没有具体阐述，但是思想是与其它同类性库一致的，采取的都是提前解析 `schema`, 然后解析 `schema`，由 `schema` 解析出的数据和属性访问拼接字符串返回。都是计算前置的优化方式～

# Refer

[JSON.stringify MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)

[JSON.stringify ECMA262-5.1](https://www.ecma-international.org/ecma-262/5.1/#sec-15.12.3)