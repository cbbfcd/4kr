import { extend, noop } from './utils'

export function createRenderer(methods) {
    return extend(Renderer, methods);
}

export let middlewares = []

// TODO: 这里很多字段暂时还不知道啥用处，后续看的时候回来补充
export const Renderer = {
    controlledCbs: [],
    mountOrder: 1,
    macrotasks: [],
    boundaries: [],
    onBeforeRender: noop,
    onAfterRender: noop,
    onDispose: noop,
    middleware(obj) {
        if (obj.begin && obj.end) middlewares.push(obj)
    },
    updateControlled(){},
    // 倒序执行一遍 begin 或者顺序执行一遍 end
    fireMiddlewares(begin) {
        let index = begin ? middlewares.length - 1 : 0,
            delta = begin ? -1 : 1,
            method = begin ? 'begin' : 'end',
            obj;
        while((obj = middlewares[index])) {
            obj[method]()
            index += delta
        }
    },
    currentOwner: null // vnode
}