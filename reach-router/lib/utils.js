/**
 * utils.js 工具函数
 * 
 * @reader 波比小金刚
 * @link https://github.com/reach/router/blob/master/src/lib/utils.js
 */

import invariant from 'invariant'

// 兼容的写法嘛，下面推荐一个大神写的 polyfill
// https://github.com/mathiasbynens/String.prototype.startsWith/blob/master/startswith.js
// 可以尝试看能写出多少种实现:
// 比如 new RegExp(`^${search}`).test(string)、string.indexOf(search) === 0
let startsWith = (string, search) => {
    return string.substr(0, search.length) === search
}

// pick(routes, uri)
//
// Ranks and picks the best route to match. Each segment gets the highest
// amount of points, then the type of segment gets an additional amount of
// points where
//
//     static > dynamic > splat > root
//
// This way we don't have to worry about the order of our routes, let the
// computers do it.
//
// A route looks like this
//
//     { path, default, value }
//
// And a returned match looks like:
//
//     { route, params, uri }
//
// I know, I should use TypeScript not comments for these types.
let pick = (routes, uri) => {
    let match
    let default_

    let [uriPathName] = uri.split('?')
    let uriSegments = segmentize(uriPathName)
    // '' or '/'
    let isRootUri = uriSegments[0] === ''
    // 对 routes 进行处理并降序返回一个数组
    let ranked = rankRoutes(routes)

    // 双层循环，目的就是让每个 route 的每个 segment 都和 uri 的每个 segment 做比较
    // 这样是否意味着大型项目，reach/router 并不合适，比如百度云现在的路由至少几百个，每个基本平均 4-8个 segment，这 O(n^2) 还是可观了。
    for (let i = 0, l = ranked.length; i < l; i++) {
        let missed = false
        let route = ranked[i].route

        // NOTE: 路由都没匹配到的话，如果有 default 参数的组件，则匹配上！
        // 看最后的返回， return match || default_ || null，也是这个意思，匹配不到就看有没有 default 路由
        if (route.default) {
            default_ = {
                route,
                params: {},
                uri
            }
            continue
        }

        let routeSegments = segmentize(route.path)
        let params = {}
        let max = Math.max(uriSegments.length, routeSegments.length)
        let index = 0

        for (; index < max; index++) {
            let routeSegment = routeSegments[index]
            let uriSegment = uriSegments[index]

            let isSplat = routeSegment === '*'
            if (isSplat) {
                // Hit a splat, just grab the rest, and return a match
                // uri:   /files/documents/work
                // route: /files/*
                params['*'] = uriSegments
                    .slice(index)
                    .map(decodeURIComponent)
                    .join('/')
                break
            }

            if (uriSegment === undefined) {
                // URI is shorter than the route, no match
                // uri:   /users
                // route: /users/:userId
                missed = true
                break
            }

            let dynamicMatch = paramRe.exec(routeSegment)

            if (dynamicMatch && !isRootUri) {
                // 命中动态路由，判断不能使用保留关键字
                // uri:   /users/123
                // route: /users/:id
                let matchIsNotReserved = reservedNames.indexOf(dynamicMatch[1]) === -1;
                invariant(
                    matchIsNotReserved,
                    `<Router> dynamic segment "${dynamicMatch[1]}" is a reserved name. Pls use a different name in path "${route.path}"`
                )
                let value = decodeURIComponent(uriSegment)
                params[dynamicMatch[1]] = value
            } else if (routeSegment !== uriSegment) {
                // Current segments don't match, not dynamic, not splat, so no match
                // uri:   /users/123/settings
                // route: /users/:id/profile
                missed = true
                break
            }
        }

        if (!missed) {
            match = {
                route,
                params,
                uri: '/' + uriSegments.slice(0, index).join('/')
            }
        }
    }

    return match || default_ || null
}

////////////////////////////////////////////////////////////////////////////////
// match(path, uri) - Matches just one path to a uri, also lol
let match = (path, uri) => pick([{path}], uri)

////////////////////////////////////////////////////////////////////////////////
// resolve(to, basepath)
//
// Resolves URIs as though every path is a directory, no files.  Relative URIs
// in the browser can feel awkward because not only can you be "in a directory"
// you can be "at a file", too. For example
//
//     browserSpecResolve('foo', '/bar/') => /bar/foo
//     browserSpecResolve('foo', '/bar') => /foo
//
// But on the command line of a file system, it's not as complicated, you can't
// `cd` from a file, only directories.  This way, links have to know less about
// their current path. To go deeper you can do this:
//
//     <Link to="deeper"/>
//     // instead of
//     <Link to=`{${props.uri}/deeper}`/>
//
// Just like `cd`, if you want to go deeper from the command line, you do this:
//
//     cd deeper
//     # not
//     cd $(pwd)/deeper
//
// By treating every path as a directory, linking to relative paths should
// require less contextual information and (fingers crossed) be more intuitive.
let resolve = (to, base) => {
    // resolce('/foo/bar', '/baz/qux') => '/foo/bar'
    // 意思就是加上了 / 就不再使用相对路径了
    // 这样更灵活，可以使用相对路径，也可以不用
    // <Link to='user'><Link to='info'></Link> 也可以 <Link to='user'><Link to='/user/info'></Link>
    if (startsWith(to, '/')) {
        return to
    }

    let [toPathname, toQuery] = to.split('?')
    let [basePathname] = base.split('?')

    let toSegments = segmentize(toPathname)
    let baseSegments = segmentize(basePathname)

    // ?a=b, /users?b=c => /users?a=b
    if (toSegments[0] === '') {
        return addQuery(basePathname, toQuery)
    }

    // profile, /users/789 => /users/789/profile
    // QUESTION: 对于 /user/.././info 这样的话，是不是有问题？
    // 验证了一下肯定是有问题的，这里应该是判断 includes('.') 吧！
    if (!startsWith(toSegments[0], '.')) {
        let pathname = baseSegments.concat(toSegments).join('/')
        return addQuery((basePathname === '/' ? '' : '/') + pathname, toQuery)
    }

    // ./         /users/123  =>  /users/123
    // ../        /users/123  =>  /users
    // ../..      /users/123  =>  /
    // ../../one  /a/b/c/d    =>  /a/b/one
    // .././one   /a/b/c/d    =>  /a/b/c/one
    let allSegments = baseSegments.concat(toSegments)
    let segments = []
    for (let i = 0, l = allSegments.length; i < l; i++) {
        let segment = allSegments[i]
        if (segment === '..') segments.pop()
        // 等于 '.' 表示当前路径，啥也不干就行了
        else if (segment !== '.') segments.push(segment)
    }

    return addQuery('/' + segments.join('/'), toQuery)
}

////////////////////////////////////////////////////////////////////////////////
// insertParams(path, params)
let insertParams = (path, params) => {
    let segments = segmentize(path)
    return (
        '/' +
        segments
            .map(segment => {
                let match = paramRe.exec(segment)
                return match ? params[match[1]] : segment
            })
            .join('/')
    )
}

// 只是字符串比较
let validateRedirect = (from, to) => {
    let filter = segment => isDynamic(segment)
    let fromString = segmentize(from)
        .filter(filter)
        .sort()
        .join('/')
    let toString = segmentize(to)
        .filter(filter)
        .sort()
        .join('/')
    return fromString === toString
}

////////////////////////////////////////////////////////////////////////////////
// ⚠️ 有人会疑惑为啥全部都是 let 声明，而且还会将工具函数写在最后边，不是有暂时性死区嘛
// ⚠️ 对，但是，在初始化之前只是在一些函数中使用了，并不会被监测到，因为那些函数没有执行，并且 let 是要提升的，所以
// ⚠️ 某种程度上和 var 是一样的，只是加了一些限制和额外的功能罢了
// ⚠️ 不过我个人不觉得这种写法好


// 匹配 eg => '/:instanceId'
let paramRe = /^:(.+)/;

// 每个路由片段都有基础分 4 分
let SEGMENT_POINTS = 4
// 静态路由地址（eg: /a） 3 分
let STATIC_POINTS = 3
// 动态路由地址（eg: /:id） 2 分
let DYNAMIC_POINTS = 2
// 通配符扣 1 分 (eg: /groups/:groupId/users/\* 这个地址只有 19 分)
// ⚠️还会扣去这个片段的 4 分哦
let SPLAT_PENALTY = 1
// 根路由地址（eg: '/'）1 分
let ROOT_POINTS = 1

let isRootSegment = segment => segment === ''
let isDynamic = segment => paramRe.test(segment)
let isSplat = segment => segment === '*'

// 具体的排名策略，就是给各个 segment 打分，然后算出总分
// 官网很清楚的阐述了其排名的策略：https://reach.tech/router/ranking
let rankRoute = (route, index) => {
    // NOTE: 比如 /* 应该是 -1 分吧，那么 default 的优先级比他还高点，但是优先返回的还是 match ，也就是命中的！
    // 所以 /* 和 default 同时存在的情况下， /* 其实还是优先级更高的
    let score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            // 每个片段都有的基础分加上
            score += SEGMENT_POINTS
            // 如果是根路由，加上
            if (isRootSegment(segment)) score += ROOT_POINTS
            // 如果是动态路由，加上
            else if (isDynamic(segment)) score += DYNAMIC_POINTS
            // 如果是通配符，扣去
            else if (isSplat(segment)) score -= SEGMENT_POINTS + SPLAT_PENALTY
            // 静态路由
            else score += STATIC_POINTS
            return score
        }, 0)

    return { route, score, index }
}

// 对 routes 进行排名，并降序输出
let rankRoutes = routes => 
    routes
        .map(rankRoute)
        .sort(
            // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
            (a, b) => 
                // 按照得分降序，得分一样的情况，先出现的优先
                a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
        )

// 把地址切片：去除首尾斜线之后，按照斜线切片
// eg: segmentize('/a/b/c'); -> ['a', 'b', 'c']
let segmentize = uri => 
    uri
        // 去除首尾斜线
        .replace(/(^\/+|\/+$)/g, '')
        .split('/')

// 保留词，被预定了，不可用
let reservedNames = ["uri", "path"];

let addQuery = (pathname, query) => pathname + (query ? `?${query}` : '')

export { startsWith, pick, match, resolve, insertParams, validateRedirect }