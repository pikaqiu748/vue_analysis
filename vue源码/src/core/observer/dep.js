/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor() {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  // 在 dep.depend 方法内部又判断了一次 Dep.target 是否有值，有的同学可能会有疑问，这不是多此一举吗？其实这么做并不多余，因为 dep.depend 方法除了在属性的 get 拦截器函数内被调用之外还在其他地方被调用了，这时候就需要对 Dep.target 做判断，至于在哪里调用的我们后面会讲到。
  depend () {
    // dep.target就是个watcher
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 但是当同步执行的观察者时，由于 flushSchedulerQueue 函数是立即执行的，它不会等待所有观察者入队之后再去执行，这就没有办法保证观察者回调的正确更新顺序，这时就需要如上高亮的代码，其实现方式是在执行观察者对象的 update 更新方法之前就对观察者进行排序，从而保证正确的更新顺序。
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      // 在异步执行观察者的时候，当数据状态方式改变时，会通过如上 notify 函数通知变化，从而执行所有观察者的 update 方法，在 update 方法内会将所有即将被执行的观察者都添加到观察者队列中，并在 flushSchedulerQueue 函数内对观察者回调的执行顺序进行排序
      subs[i].update()
    }
  }
}

// The cur rent target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
