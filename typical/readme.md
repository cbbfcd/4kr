# typical

> [项目地址](https://github.com/camwiegert/typical)

> [在线DEMO](https://codepen.io/camwiegert/pen/rNNepYo)

## 源码分析

因为真的代码很少很少，但是设计精巧，效果显著，不得不服！

```js
// 这个方法就是输出的接口，精美！
export async function type(node, ...args) {
    for (const arg of args) {
        switch (typeof arg) {
            // 字符串就编辑
            case 'string':
                await edit(node, arg);
                break;
            // 数字就等
            case 'number':
                await wait(arg);
                break;
            // 函数就执行，所以如果传 type 自身，就是 loop 了
            case 'function':
                await arg(node, ...args);
                break;
            // https://github.com/camwiegert/typical/blob/master/readme.md#waiting
            // 可以把一个 type 处理传入另一个中，反正都要 wait
            default:
                await arg;
        }
    }
}

async function edit(node, text) {
    const overlap = getOverlap(node.textContent, text);
    await perform(node, [...deleter(node.textContent, overlap), ...writer(text, overlap)]);
}

async function wait(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

// 一个一个敲上去的效果
async function perform(node, edits, speed = 60) {
    for (const op of editor(edits)) {
        op(node);
        await wait(speed + speed * (Math.random() - 0.5));
    }
}

// 生成器，结果是个 iterator，可以被 for...of 遍历
export function* editor(edits) {
    for (const edit of edits) {
        yield (node) => requestAnimationFrame(() => node.textContent = edit);
    }
}

export function* writer([...text], startIndex = 0, endIndex = text.length) {
    while (startIndex < endIndex) {
        yield text.slice(0, ++startIndex).join('');
    }
}

export function* deleter([...text], startIndex = 0, endIndex = text.length) {
    while (endIndex > startIndex) {
        yield text.slice(0, --endIndex).join('');
    }
}
// 找不同
// [...end] 类数组 -> 数组
export function getOverlap(start, [...end]) {
    // findIndex 可以找到 NaN，底层使用了 Object.is 比较的，indexOf 可不行
    // 如果有 NaN，返回的值是 text.length，那么 deleter 和 writer 都不会执行了
    return [...start, NaN].findIndex((char, i) => end[i] !== char);
}
```