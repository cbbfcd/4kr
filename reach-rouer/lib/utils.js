/**
 * utils.js 工具函数，保留作者原来的注释，因为更能表示其意图
 * 
 * @reader 波比小金刚
 * @link https://github.com/reach/router/blob/master/src/lib/utils.js
 */

import invariant from 'invariant';

// 兼容的写法嘛，下面推荐一个大神写的 polyfill
// https://github.com/mathiasbynens/String.prototype.startsWith/blob/master/startswith.js
// 可以尝试看能写出多少种实现:
// 比如 new RegExp(`^${search}`).test(string)、string.indexOf(search) === 0
let startsWith = (string, search) => {
    return string.substr(0, search.length) === search;
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

}