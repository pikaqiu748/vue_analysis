/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  // 置为true,表示watcher队列正在被刷新
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 这些id是在创建watcher的时候，自增的
  // 1. 组件从父级更新到子级。（因为父对象总是在子对象之前创建）
  // 2. 组件的用户观察者函数在其渲染观察者函数之前运行（因为用户观察函数在渲染观察函数前创建）
  // 3. 如果某个组件在父组件的观察程序运行期间被销毁，则可以跳过其观察程序。
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 不要缓存长度，因为在运行现有的观察程序时，可能会推送更多的观察者
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      // 如果有before钩子，则先执行
      watcher.before()
    }
    id = watcher.id
    // 置为null,这样下次更新时，这个watcher，又可以进来
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 量 has 定义在 scheduler.js 文件头部，它是一个空对象：let has: { [key: number]: ?true } = {}
  // 该 if 语句以及变量 has 的作用就是用来避免将相同的观察者重复入队的
  if (has[id] == null) {
    // 在该 if 语句块内执行了真正的入队操作
    has[id] = true
    // flushing 变量也定义在 scheduler.js 文件的头部，它的初始值是 false
    // 当更新开始时会将 flushing 变量的值设置为 true，代表着此时正在执行更新，所以根据判断条件 if (!flushing) 可知只有当队列没有执行更新时才会简单地将观察者追加到队列的尾部，
    if (!flushing) {
      // 其中 queue 常量也定义在 scheduler.js 文件的头部：const queue: Array<Watcher> = []
      queue.push(watcher)
    } else {
      // 当变量 flushing 为真时，说明队列正在执行更新，这时如果有观察者入队则会执行 else 分支中的代码，这段代码的作用是为了保证观察者的执行顺序.
      // 判断 flushing 标识，处理 Watcher 渲染时，可能产生的新 Watcher。
      // 如：触发了 v-if 的条件，新增的 Watcher 渲染。
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 定义在 scheduler.js 文件头部，初始值为 false
    if (!waiting) {
      // 在 if 语句块内先将 waiting 的值设置为 true，这意味着无论调用多少次 queueWatcher 函数，该 if 语句块的代码只会执行一次
      waiting = true

      // 例如，在非生产环境下，如果计算属性设置为同步，即!async,则只需要将原本需要通过nexttick包装成为微任务的
      //flushSchedulerQueue()直接执行即可

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      // 调用 nextTick 并以 flushSchedulerQueue 函数作为参数，其中 flushSchedulerQueue 函数的作用之一就是用来将队列中的观察者统一执行更新的。其实最好理解的方式就是把 nextTick 看做 setTimeout(fn, 0)

      // 我们完全可以使用 setTimeout 替换 nextTick，我们只需要执行一次 setTimeout 语句即可，waiting 变量就保证了 setTimeout 语句只会执行一次，这样 flushSchedulerQueue 函数将会在下一次事件循环开始时立即调用，但是既然可以使用 setTimeout 替换 nextTick 那么为什么不用 setTimeout 呢？原因就在于 setTimeout 并不是最优的选择，nextTick 的意义就是它会选择一条最优的解决方案，接下来我们就讨论一下 nextTick 是如何实现的。
      // nextTick 函数来自于 src/core/util/next-tick.js 文件
      nextTick(flushSchedulerQueue)
    }
  }
}
