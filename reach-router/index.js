/**
 * @reader 波比小金刚
 * @link https://github.com/reach/router/blob/master/src/index.js
 */

import React from "react";
import warning from "warning";
import PropTypes from "prop-types";
import invariant from "invariant";

// 这两个库只是为了兼容以前的老版本，并且能够使用新特性
import createContext from "create-react-context";
import { polyfill } from "react-lifecycles-compat";

import {
  startsWith,
  pick,
  resolve,
  match,
  insertParams,
  validateRedirect
} from "./lib/utils";
import {
  globalHistory,
  navigate,
  createHistory,
  createMemorySource
} from "./lib/history";

////////////////////////////////////////////////////////////////////////////////

// 利用 context 的穿透特性去派发路由数据
// context 的一些资料：
// https://zhuanlan.zhihu.com/p/42654080
// https://zhuanlan.zhihu.com/p/28037267 
// https://zhuanlan.zhihu.com/p/33925435
const createNamedContext = (name, defaultValue) => {
    const Ctx = createContext(defaultValue)
    Ctx.Consumer.displayName = `${name}.Consumer`
    Ctx.Provider.displayName = `${name}.Provider`
    return Ctx
}

////////////////////////////////////////////////////////////////////////////////

// Location Context/Provider
let LocationContext = createNamedContext('Location')

// sets up a listener if there isn't one already so apps don't need to be
// wrapped in some top level provider
// https://reach.tech/router/api/Location
// Location 组件的目的是在任何地方使用的时候都可以通过 context 向下传递 location ，通过 render props 获取，不然可能获取不到的
// 有点像 react-router 中的 withRouter 的作用一样
let Location = ({ children }) => (
    // NOTE: 如果外层没有 Provider 注入 value，那么 Consumer 消费的就是 createContext() 中传入的 defaultValue
    // https://zh-hans.reactjs.org/docs/context.html#reactcreatecontext
    <LocationContext.Consumer>
        {
            // render props
            // https://zh-hans.reactjs.org/docs/render-props.html#using-props-other-than-render
            context => 
                context ? (
                    children(context)
                ) : (
                    <LocationProvider>{children}</LocationProvider>
                )
        }
    </LocationContext.Consumer>
)

class LocationProvider extends React.Component {
    static propTypes = {
        history: PropTypes.object.isRequired
    }

    // defaultProps 的解析过程在 state 初始化之前
    static defaultProps = {
        history: globalHistory
    }

    state = {
        context: this.getContext(),
        refs: { unlisten: null }
    }

    // context => { navigate, location}
    getContext() {
        let {
            props: {
                history: { navigate, location }
            }
        } = this

        return { navigate, location }
    }

    // https://www.zcfy.cc/article/2-minutes-to-learn-react-16s-componentdidcatch-lifecycle-method
    componentDidCatch(error, errInfo) {
        // NOTE: 直接把重定向当异常抛出，利用 componentDidCatch 来捕获
        if (isRedirect(error)) {
            let {
                props: { 
                    history: { navigate }
                }
            } = this
            // NOTE: 为啥重定向要 replace
            // https://stackoverflow.com/questions/503093/how-do-i-redirect-to-another-webpage
            navigate(error.uri, { replace: true })
        } else {
            throw error
        }
    }

    // https://zh-hans.reactjs.org/docs/react-component.html#componentdidupdate
    componentDidUpdate(preProps, preState) {
        // 为啥比较 location，看 history 的代码，监听函数执行是 listener({location, action});
        // 所以导航到另一个页面，location 会变，在页面完全更新之后，就应该重置锁状态，让 Promise 绝议
        if (preState.context.location !== this.state.context.location) {
            // 在执行 navigate 函数的情况下，重置锁状态，让 Promise 绝议
            // 之所以选择这个生命周期，是因为这个时候已经完成更新，百分百的 completely finished，这对一些进出场动画还是挺有用的
            this.props.history._onTransitionComplete()
        }
    }

    componentDidMount() {
        let {
            state: { refs },
            props: { history }
        } = this

        // 监听，路由变化触发监听函数执行，向下派发新的 context
        // NOTE: 当 Provider 的 value 值发生变化时，它内部的所有消费组件都会重新渲染
        refs.unlisten = history.listen(() => {
            // 在 nextTick 执行
            Promise.resolve().then(() => {
                // https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame
                // 在下一次重绘之前执行
                requestAnimationFrame(() => {
                    // 监听函数是接收了 location 和 action 参数的，这里不需要使用，因为
                    // Location 组件的目的就只是为了在任何地方都可以为子组件提供 location 对象，使用场景比如：动画
                    if (!this.unmounted) {
                        this.setState(() => ({context: this.getContext()}))
                    }
                })
            })
        })
    }

    componentWillUnmount() {
        let {
            state: { refs }
        } = this

        this.unmounted = true
        refs.unlisten()
    }

    render() {
        let {
            state: { context },
            props: { children }
        } = this
        return (
            // 所以官方文档说通过 render props 方式获取 location 数据呢！
            <LocationContext.Provider value={context}>
                {typeof children === 'function' ? children(context) : children || null}
            </LocationContext.Provider>
        )
    }
}

////////////////////////////////////////////////////////////////////////////////

// https://reach.tech/router/api/ServerLocation
// https://reach.tech/router/server-rendering
let ServerLocation = ({url, children}) => (
    <LocationContext.Provider 
        value={{
            location: {
                pathname: url,
                search: '',
                hash: ''
            },
            // NOTE: 不还可以使用直接 import 的吗，这个方法里就应该直接加一层判断，而不是在这里加。
            navigate: () => {
                throw new Error(`you can't call navigate on the server`)
            }
        }}
    >
        {children}
    </LocationContext.Provider>
)

////////////////////////////////////////////////////////////////////////////////

// Sets baseuri and basepath for nested routers and links
let BaseContext = createNamedContext('Base', { baseuri: '/', basepath: '/' })

////////////////////////////////////////////////////////////////////////////////

// The main event, welcome to the show everybody.
// https://reach.tech/router/api/Router
// 反正就是把 base 和 location 的 context 都揉进 RouteImpl 里了
let Router = props => (
    <BaseContext.Consumer>
        {
            baseContext => (
                <Location>
                    {
                        locationContext => (
                            <RouteImpl {...baseContext} {...locationContext} {...props}/>
                        )
                    }
                </Location>
            )
        }
    </BaseContext.Consumer>
)

class RouteImpl extends React.PureComponent {
    static defaultProps = {
        
    }

    render() {
        let {
            location,
            navigate,
            basepath,
            primary,
            children,
            baseuri,
            component = 'div',
            ...domProps
        } = this.props
        // utils.js 中需要的 routes 在这里生成的
        let routes = React.children.map(children, createRoute(basepath));
        let { pathname } = location

        let match = pick(routes, pathname);

        // 如果匹配到了
        if (match) {
            let {
                params,
                uri,
                route,
                route: { value: element } // NOTE: 还可以这样操作
            } = match

            // remove the /* from the end for child routes relative paths
            basepath = route.default ? basepath : route.path.replace(/\*$/, '')

            let props = {
                ...params,
                uri,
                location,
                // 相对路径的处理
                navigate: (to, options) => navigate(resolve(to, uri), options)
            }

            let clone = React.createElement(
                element,
                props,
                element.props.children ? (
                    // 递归下去
                    <Router primary={primary}>{element.props.children}</Router>
                ) : (
                    undefined
                )
            )

            // using 'div' for < 16.3 support
            let FocusWrapper = primary ? FocusHandler : component
            // don't pass any props to 'div'
            let wrapperProps = primary
                ? { uri, location, component, ...domProps }
                : domProps

            return (
                <BaseContext.Provider value={{baseuri: uri, basepath}}>
                    <FocusWrapper {...wrapperProps}>{clone}</FocusWrapper>
                </BaseContext.Provider>
            )
        } else {
            // Not sure if we want this, would require index routes at every level
            // warning(
            //   false,
            //   `<Router basepath="${basepath}">\n\nNothing matched:\n\t${
            //     location.pathname
            //   }\n\nPaths checked: \n\t${routes
            //     .map(route => route.path)
            //     .join(
            //       "\n\t"
            //     )}\n\nTo get rid of this warning, add a default NotFound component as child of Router:
            //   \n\tlet NotFound = () => <div>Not Found!</div>
            //   \n\t<Router>\n\t  <NotFound default/>\n\t  {/* ... */}\n\t</Router>`
            // );
            return null
        }
    }
}

let FocusContext = createNamedContext('Focus')

let FocusHandler = ({uri, location, component, ...domProps}) => (
    <FocusContext.Consumer>
        {
            requestFocus => (
                <FocusHandlerImpl 
                    {...domProps}
                    component={component}
                    requestFocus={requestFocus}
                    uri={uri}
                    location={location}
                />
            )
        }
    </FocusContext.Consumer>
)

// don't focus on initial render
let initialRender = true;
let focusHandlerCount = 0

// 说实话，没发觉有啥大用处，而且我跑 demo 硬是没看出来效果
class FocusHandlerImpl extends React.Component {
    state = {}

    // 为啥不惜用 polyfill 也要用这个生命周期，因为这个生命周期贯穿整个 React 从初始化到更新的过程
    // 老的生命周期不满足这个要求
    static getDerivedStateFromProps(nextProps, prevState) {
        let initial = prevState.uri == null;
        if (initial) {
            return {
                shouldFocus: true,
                ...nextProps
            }
        } else {
            let myURIChanged = nextProps.uri !== prevState.uri
            let navigateUpToMe = 
                prevState.location.pathname !== nextProps.location.pathname &&
                nextProps.location.pathname === nextProps.uri

            return {
                shouldFocus: myURIChanged || navigateUpToMe,
                ...nextProps
            }
        }
    }

    componentDidMount() {
        focusHandlerCount++;
        this.focus()
    }

    // 计步器，保证嵌套的节点也不会在初始化阶段 focus
    componentWillUnmount() {
        focusHandlerCount--;
        if (focusHandlerCount === 0) {
            initialRender = true
        }
    }

    // 看起来嵌套的子组件是无论如何不会 focus 的
    componentDidUpdate(preProps, preState) {
        if (preProps.location !== this.props.location && this.state.shouldFocus) {
            this.focus()
        }
    }

    focus() {
        if (ProcessingInstruction.env.NODE_ENV === 'test') return;

        let { requestFocus } = this.props

        if (requestFocus) {
            requestFocus(this.node)
        } else {
            // 第一次 render 不会 focus
            if (initialRender) {
                initialRender = false;
            } else {
                // React polyfills [autofocus] and it fires earlier than cDM,
                // so we were stealing focus away, this line prevents that.

                // https://developer.mozilla.org/en-US/docs/Web/API/DocumentOrShadowRoot/activeElement
                // https://developer.mozilla.org/zh-CN/docs/Web/API/Node/contains
                if (!this.node.contains(document.activeElement)) {
                    this.node.focus()
                }
            }
        }
    }

    requestFocus = node => {
        if (!this.state.shouldFocus) {
            node.focus()
        }
    }

    render() {
        let {
            children,
            style,
            requestFocus,
            role = 'group',
            component: Comp = 'div',
            uri,
            location,
            ...domProps   
        } = this.props

        // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Global_attributes/tabindex
        return (
            <Comp
              style={{outline: 'none', ...style}}
              tabIndex='-1'
              role={role}
              ref={n => (this.node = n)}
              {...domProps}
            >
                <FocusContext.Provider value={this.requestFocus}>
                    {this.props.children}
                </FocusContext.Provider>
            </Comp>
        )
    }
}

polyfill(FocusHandlerImpl);

let k = () => {}

////////////////////////////////////////////////////////////////////////////////

// https://zh-hans.reactjs.org/docs/react-api.html#reactforwardref
let { forwardRef } = React
if (typeof forwardRef === 'undefined') {
    forwardRef = C => C
}

let Link = forwardRef(({ innerRef, ...props}, ref) => (
    <BaseContext.Consumer>
        {
            ({basepath, baseuri}) => (
                <Location>
                    {
                        ({ location, navigate}) => {
                            let { to, state, replace, getProps = k, ...anchorProps } = props
                            let href = resolve(to, baseuri)
                            let isCurrent = location.pathname = href
                            let isPartiallyCurrent = startsWith(location.pathname, href)

                            return (
                                <a
                                    ref={ref || innerRef}
                                    aria-current={isCurrent ? 'page' : undefined}
                                    {...anchorProps}
                                    {...getProps({isCurrent, isPartiallyCurrent, href, location})}
                                    href={href}
                                    onClick={event => {
                                        if (anchorProps.onClick) anchorProps.onClick(event)
                                        if (shouldNavigate(event)) {
                                            event.preventDefault()
                                            navigate(href, {state, replace})
                                        }
                                    }}
                                />
                            )
                        }
                    }
                </Location>
            )
        }
    </BaseContext.Consumer>
))

function RedirectRequest(uri) {
    this.uri = uri
}

let isRedirect = o => o instanceof RedirectRequest

// 这个思路绝了，利用 componentDidCatch 的捕捉能力，直接在子组件任何需要的地方抛出特定异常
// 然后顶层组件 catch 到这个特殊异常之后，执行重定向操作。服！
let redirectTo = to => {
    throw new RedirectRequest(to)
}

class RedirectImpl extends React.Component {
    // Support React < 16 with this hook
    // 因为没有 didCatch
    componentDidMount() {
        let {
            props: {
                navigate,
                to,
                from,
                replace = true,
                state,
                noThrow,
                baseuri,
                ...props
            }
        } = this

        Promise.resolve().then(() => {
            let resolveTo = resolve(to, baseuri);
            navigate(insertParams(resolveTo, props), {replace, state})
        })
    }

    render() {
        let {
            props: { navigate, to, from, replace, state, noThrow, baseuri, ...props }
        } = this

        let resolveTo = resolve(to, baseuri)
        if (!noThrow) redirectTo(insertParams(resolveTo, props))
        return null
    }
}

let Redirect = props => (
    <BaseContext.Consumer>
        {
            ({baseuri}) => (
                <Location>
                    {
                        locationContext => (
                            <RedirectImpl {...locationContext} {...props} baseuri={baseuri}/>
                        )
                    }
                </Location>
            )
        }
    </BaseContext.Consumer>
)

Redirect.propTypes = {
    from: PropTypes.string,
    to: PropTypes.string.isRequired
};

////////////////////////////////////////////////////////////////////////////////

let Match = ({path, children}) => (
    <BaseContext.Consumer>
        {
            ({baseuri}) => (
                <Location>
                    {
                        ({navigate, location}) => {
                            let resolvePath = resolve(path, baseuri)
                            let result = match(resolvePath, location.pathname)
                            return children({
                                navigate,
                                location,
                                match: result
                                    ? {
                                        ...result.params,
                                        uri: result.uri,
                                        path
                                    }
                                    : null
                            })
                        }
                    }
                </Location>
            )
        }
    </BaseContext.Consumer>
)

let stripSlashes = str => str.replace(/(^\/+|\/+$)/g, "");

let shouldNavigate = event =>
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

let createRoute = basepath => element => {
    if (!element) {
        return null
    }

    invariant(
        element.props.path || element.props.default || element.type === Redirect,
        `<Route>: Children of <Router> must have a 'path' or 'default' prop, or be a 'Redirect'.
        none found on element type ${element.type}
        `
    )

    invariant(
        !(element.type === Redirect && (!element.props.from || !element.props.to)),
        `<Redirect from='${element.props.from}' to='${element.props.to}'> requres both 'from' and 'to' props when inside a <Router>`
    )

    // QUESTION: 为啥设计上，在 Router 中使用 Redirect 组件，from 和 to 必须同时要有，而且要匹配?
    invariant(
        !(
            element.type === Redirect &&
            !validateRedirect(element.props.from, element.props.to)
        ),
        `<Redirect from="${element.props.from} to="${
            element.props.to
        }"/> has mismatched dynamic segments, ensure both paths have the exact same dynamic segments.`
    )

    // 如果设置了 default
    if (element.props.default) {
        return {value: element, default: true}
    }

    let elementPath = element.type === Redirect ? element.props.from : element.props.path;

    let path = 
        elementPath === '/'
            ? basepath
            : `${stripSlashes(basepath)}/${stripSlashes(elementPath)}`
    
    return {
        value: element,
        default: element.props.default,
        path: element.props.children ? `${stripSlashes(path)}/*` : path
    }
}

////////////////////////////////////////////////////////////////////////////////