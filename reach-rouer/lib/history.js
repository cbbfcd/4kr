/**
 * @reader 波比小金刚
 * @link https://github.com/reach/router/blob/master/src/lib/history.js
 */

/**
 * 获取封装的 location 对象，这里的 source 其实就是 window 对象
 * @param {*} source window | createMemorySource() 该函数返回值是为了测试或者以后支持 native 的时候
 */
let getLocation = source => {
    return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || 'initial'
    }
}

/**
 * 创建 History 的方法，这个方法几乎也用不到
 * 几乎是 history 最小实现了，就原生 history 的能力 + 发布订阅，足够了。
 * 从兼容性出发，对 history 的支持基本 IE10 及以上都差不多了，完全符合需要。
 * https://developer.mozilla.org/zh-CN/docs/Web/API/History_API
 * 
 * @param {*} source window | createMemorySource()
 * @param {*} options 貌似没用到
 */
let createHistory = (source, options) => {
    let listeners = []
    let location = getLocation(source)
    // 一个锁
    let transitioning = false
    let resolveTransition = () => {}

    return {
        get location() {
            return location
        },

        get transitioning() {
            return transitioning
        },

        // 目前只能这么象征性的表示这是私有方法，private？#？
        // 这个函数在这个文件暂时也没用到，那锁的状态不能恢复啊？
        // 没事，接着看，这里肯定在别的地方有用到，以重置锁的状态（全库搜索一下，发现在 index.js 中使用了）
        _onTransitionComplete() {
            transitioning = false;
            resolveTransition();
        },

        listen(listener) {
            listeners.push(listener)

            let popstateListener = () => {
                location = getLocation(source)
                listener({location, action: 'POP'})
            }

            // https://developer.mozilla.org/zh-CN/docs/Web/API/Window/popstate_event
            // 一般来说，利用 history 做路由器，会监听 popstate 事件，以及对 history.pushState 和 replaceState 做单独的处理
            // 因为 popstate 只有在做出浏览器动作时，才会触发该事件，如用户点击浏览器的回退按钮、点击某链接、（或者在 Javascript 代码中调用 history.back()）
            // 这里需要注意的是，触发 popstate 事件之后，监听了该事件的所有不同函数都会执行，这里每次 listen 都会绑定一个新的 popstateListener 到 popstate事件
            source.addEventListener('popstate', popstateListener)

            // 最佳实践，监听函数返回一个 unSubscribe 函数
            return () => {
                source.removeEventListener('popstate', popstateListener)
                listeners = listeners.filter(fn => fn !== listener)
            }
        },

        // 编程的方式去 link to，类似 react-router 中的 history.replace({pathname: 'xxx', state: {}})
        navigate(to, {state, replace = false} = {}) {
            // 看完这个方法，你可能会想，我传的 state 是怎么传到新页面去的
            // 其实，这里带的参数 state 最后在页面上本质还是通过 history.state 这个原生 API 取的，还是结构化拷贝的！
            state = {...state, key: Date.now() + ''}
            // try...catch iOS Safari limits to 100 pushState calls
            try {
                if (transitioning || replace) {
                    // 这个 API 在MDN上有详细的解释，state 是一个结构化拷贝的对象，最大 640kb（所以可以用 history 实现深度克隆哦！）
                    // 最后一个参数可以是也可以不是相对路径，这个函数不会触发 popstate 事件
                    // 在全局的浏览器历史记录中还是会生成一条记录的
                    source.history.replaceState(state, null, to)
                } else {
                    source.history.pushState(state, null, to)
                }
            } catch (error) {
                // 如果超过 100 次 pushState 调用抛异常（IOS Safari）就用原生的 location.replace() 或者 location.assign()
                // https://developer.mozilla.org/zh-CN/docs/Web/API/Location/replace
                source.location[replace ? 'replace' : 'assign'](to);
            }

            // popstate 事件是自动触发，而 pushState 或者是 replaceState 需要我们手动去触发监听事件
            // 这里的 location 中的 state 以及替换成你传的 state 了
            location = getLocation(source)
            // 这个锁的目的要看在什么阶段重置锁状态，在这期间，再次发起 navigate 都将是 replaceState，不会增加历史记录
            transitioning = true
            // 这里其实很巧妙，这里涉及 promise 的知识，我在下边单独注释解释一下
            // 手动实现 PromiseA+ 的 demo: https://codesandbox.io/s/5k1rpk163k
            let transition = new Promise(res => (resolveTransition = res))
            listeners.forEach(listener => listener({ location, action: 'PUSH' }))
            // 返回一个 promise 的作用官网也提了：
            // React 完全完成渲染才会跳转，其实也就是 _onTransitionComplete 的执行时机是完全渲染的时候，那就只有 ComponentDidUpdate 了。
            // 为什么不是 ComponentDidMount -> 只会执行一次啊
            // It resolves after React is completely finished rendering the next screen, even with React Suspense.
            return transition
        }
    }
}

/**
 * 关于上面代码使用的 Promise 技巧，将决议的函数 res 赋值给了 resolveTransition。
 * 这样即使后边你写了 then ，其实也不会触发，必须会等到决议函数执行之后，也就是 resolveTransition 执行，其实就是那个私有函数 _onTransitionComplete 执行之后
 * 才会触发 then。同时这个函数也重置了锁的状态，这样表示这么一个跳转彻底完成了。
 * 
 * 查看 Promise 规范，可以知道 then 执行的时候返回一个新的 promise，过程中会判断当前的状态，如果没有决议（PENDING）的状态，那么 then 中的函数将会被放进队列中
 * 等到 Promise 状态改变（决议）之后才会执行。
 * 
 * DEMO:
 * 
 * let temp = null;
 * let p = new Promise(resolve => (temp = resolve));
 * p.then(r => console.log('guess when this word will be printed?'));
 * // -> 不会输出那句话
 * temp();
 * // -> guess when this word will be printed?
 */


// 这个方法只是为了测试或者为了以后支持 Native 写的，简单看看就行
// 说到底就是模拟一个 window 对象，只关注 location、history、addEventListener、removeEventListener
// 非常轻巧的实现，在无 DOM 场景下的测试会非常有用，还是可以安利一下
let createMemorySource = (initialPathname = '/') => {
    let index = 0
    // 模拟浏览器的历史堆栈（location）
    let stack = [{pathname: initialPathname, search: ''}]
    let states = []

    return {
        get location() {
            return stack[index]
        },
        addEventListener(name, fn) {},
        removeEventListener(nam, fn) {},
        history: {
            get entries() {
                return stack
            },
            get index() {
                return index
            },
            get state() {
                return states[index]
            },
            pushState(state, _, uri) {
                let [pathname, search = ''] = uri.split('?')
                index++
                stack.push({pathname, search})
                states.push(state)
            },
            replaceState(state, _, uri) {
                let [pathname, search = ''] = uri.split('?')
                stack[index] = {pathname, search}
                states[index] = state
            }
        }
    }
}

// 看到很多都是这么验证的，这样比较准确
let canUseDOM = !!(
    typeof window !== undefined &&
    window.document && 
    window.document.createElement
)

// 这下边的就不说了
let getSource = () => canUseDOM ? window : createMemorySource()

let globalHistory = createHistory(getSource())

let { navigate } = globalHistory

export { globalHistory, navigate, createHistory, createMemorySource }