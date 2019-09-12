# raf

> [项目地址](https://github.com/chrisdickinson/raf)
>
> 项目作者：[chrisdickinson](https://github.com/chrisdickinson)

## About

代码真的很少，直接贴出来。

```javascript
// https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame


// 这部分利用动态属性查找，做了一些兼容的初始化工作
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60 // 1s / 60 帧
    // 其实这设计还是很巧妙的,充分利用了事件循环的特质
  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
            // _now - last 其实是上一次函数执行时间（粗略的），所以 next 是为了让每次 callback 被调用的时候都是尽量刚好耗尽一帧的时间
            // 从而 callback 会在每一帧中执行一次，而且都是在下一个 tick 执行
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0 // 这里就是释放锁
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next)) // 反正就是近似的耗尽一帧中剩余的时间
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf
  object.cancelAnimationFrame = caf
}
```