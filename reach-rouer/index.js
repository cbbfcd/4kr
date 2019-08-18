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
// context 的资料：
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
let LocationContext = createNamedContext('location')

// sets up a listener if there isn't one already so apps don't need to be
// wrapped in some top level provider
let Location = ({ children }) => (
    <LocationContext.Consumer>
        {
            // render props
            context => 
                context ? (
                    // QUESTION: children 必须是函数？
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

    static defaultProps = {
        history: globalHistory
    }

    state = {
        context: this.getContext(),
        refs: { unlisten: null }
    }

    getContext() {
        let {
            props: {
                history: { navigate, location }
            }
        } = this

        return { navigate, location }
    }

    // https://www.zcfy.cc/article/2-minutes-to-learn-react-16s-componentdidcatch-lifecycle-method
    componentDidCatch(err, errInfo) {
        // NOTE: 直接把重定向当异常抛出，利用 componentDidCatch 来捕获
        if (isRedirect(err)) {
            let {
                props: { 
                    history: { navigate }
                }
            } = this
            // NOTE: 为啥重定向要 replace
            // https://stackoverflow.com/questions/503093/how-do-i-redirect-to-another-webpage
            navigate(error.uri, { replace: true })
        } else {
            throw err
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function RedirectRequest(uri) {
    this.uri = uri
}

let isRedirect = o => o instanceof RedirectRequest

let redirectTo = to => {
    throw new RedirectRequest(to)
}