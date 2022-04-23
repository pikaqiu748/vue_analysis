/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks = []
let pending = false

function flushCallbacks () {
  // 使用 copies 常量保存一份 callbacks 的复制，然后遍历 copies 数组，并且在遍历 copies 数组之前将 callbacks 数组清空：callbacks.length = 0。为什么要这么做呢？
  // 将 pending再次置为 false，表示下一个flushCallbacks 函数可以进入浏览器的异步任务队列了
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  // 将变量 microTimerFunc 定义为一个函数，这个函数的执行将会把 flushCallbacks 函数注册为 microtask
  // nexttick会执行timerFunc(),将flushCallbacks变成微任务
  timerFunc = () => {
    // flushCallbacks 函数会按照顺序执行 callbacks 数组中的函数,flushCallbacks 函数会按照顺序执行 callbacks 数组中的函数，首先会执行 flushSchedulerQueue 函数，这个函数会遍历 queue 中的所有观察者并重新求值，完成重新渲染(re-render)，在完成渲染之后，本次更新队列已经清空，queue 会被重置为空数组,在完成渲染之后,在执行该回调函数之前已经完成了重新渲染，所以该回调函数内的代码是能够访问更新后的DOM的.
    // 下面这句代码是将flushCallbacks放在异步队列中
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 这是一个解决怪异问题的变通方法，在一些 UIWebViews 中存在很奇怪的问题，即 microtask 没有被刷新，对于这个问题的解决方案就是让浏览做一些其他的事情比如注册一个 (macro)task 即使这个 (macro)task 什么都不做，这样就能够间接触发 microtask 的刷新。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
  // 因为 setImmediate 拥有比 setTimeout 更好的性能，这个问题很好理解，setTimeout 在将回调注册为 (macro)task 之前要不停的做超时检测，而 setImmediate 则不需要，这就是优先选用 setImmediate 的原因。
  // 但是 setImmediate 的缺陷也很明显，就是它的兼容性问题，到目前为止只有IE浏览器实现了它，
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// 当调用栈空闲后每次事件循环只会从 (macro)task 中读取一个任务并执行，而在同一次事件循环内会将 microtask 队列中所有的任务全部执行完毕，且要先于 (macro)task。另外 (macro)task 中两个不同的任务之间可能穿插着UI的重渲染，那么我们只需要在 microtask 中把所有在UI重渲染之前需要更新的数据全部更新，这样只需要一次重渲染就能得到最新的DOM了。恰好 Vue 是一个数据驱动的框架，如果能在UI重渲染之前更新所有数据状态，这对性能的提升是一个很大的帮助，所有要优先选用 microtask 去更新数据状态而不是 (macro)task，这就是为什么不使用 setTimeout 的原因，因为 setTimeout 会将回调放到 (macro)task 队列中而不是 microtask 队列，所以理论上最优的选择是使用 Promise，当浏览器不支持 Promise 时再降级为 setTimeout
// 1、用try catch 包装 flushSchedulerQueue 函数，然后将其放入 callbacks 数组2、如果 pending 为 false，表示现在浏览器的任务队列中没有 flushcallbacks函数
// 如果pending 为 true，则表示浏览器的任务队列中已经被放入了flushCallbacks数,
// 等到执行 flushCallbacks函数时，pending 会被再次置为 false，表示下一个 flushCallbacks函数可以进入浏览器的任务队列了

export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  // callbacks 数组定义在文件头部：const callbacks = []
  callbacks.push(() => {
    if (cb) {
      try {
        // 注意并不是将 cb 回调函数直接添加到 callbacks 数组中，但这个被添加到 callbacks 数组中的函数的执行会间接调用 cb 回调函数，并且可以看到在调用 cb 函数时使用 .call 方法将函数 cb 的作用域设置为 ctx，也就是 nextTick 函数的第二个参数,默认是调用$nextTick的vue实例
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
      // 当 flushCallbacks 函数开始执行 callbacks 数组中的函数时，如果没有传递 cb 参数，则直接调用 _resolve 函数，我们知道这个函数就是返回的 Promise 实例对象的 resolve 函数。这样就实现了 Promise 方式的 $nextTick 方法。
    } else if (_resolve) {
      // 这里的_resove会在nexttick没有回调函数的时候会被赋值为promise中的resolve函数
      // 赋值代码在下面
      _resolve(ctx)
    }
  })
  // pending 变量也定义在文件头部：let pending = false，它是一个标识，它的真假代表回调队列是否处于等待刷新的状态，初始值是 false 代表回调队列为空不需要等待刷新。
  // 假如此时在某个地方调用了 $nextTick 方法，那么 if 语句块内的代码将会被执行，在 if 语句块内优先将变量 pending 的值设置为 true，代表着此时回调队列不为空，正在等待刷新
  // pending 的作用:保证在同一时刻,浏览器的任务队列中只有一个 flushcallbacks函数。
  if (!pending) {
    // 将pending置为true,确保在浏览器中同时只存在一个任务队列
    // 例如连续执行多个nexttick()函数，只有第一个函数会触发下面的timerfunc(),这样确保异步微任务队列只存在一个
    // flushcallback函数在微任务队列里面
    // 即后面的nexttick函数只会执行上面的callbacks.push(),将nexttick函数中的回调函数直接Push到callbacks数组中，
    // 别忘了，第一个nexttick函数已经将callbacks数组放在微任务队里里面了，因此保证了一个callbacks
    // 此外，当执行flushcallback的时候，会将pending置为false,这意味着又可以生成一个新的flushcallback
    pending = true
    // 2.执行异步任务
    // 此方法会根据浏览器兼容性，选用不同的异步策略,timefunc的作用就是将flushCallbacks函数变为异步任务，
    // flushCallbacks作用是执行callbacks数组中的所有nexttick回调函数
    timerFunc()
  }
  // $flow-disable-line
  // 当 nextTick 函数没有接收到 cb 参数时，会检测当前宿主环境是否支持 Promise，如果支持则直接返回一个 Promise 实例对象，并且将 resolve 函数赋值给 _resolve 变量，_resolve 变量声明在 nextTick 函数的顶部。
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
