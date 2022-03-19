/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor(
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    // 在lifecycle.js中，isRenderWatcher传过来的为true
    isRenderWatcher?: boolean
  ) {
    // 将当前组件实例对象 vm 赋值给该观察者实例的 this.vm 属性，也就是说每一个观察者实例对象都有一个 vm 实例属性，该属性指明了这个观察者是属于哪一个组件的
    this.vm = vm
    if (isRenderWatcher) {
      // 在 initLifecycle 函数中被初始化的，其初始值为 null
      vm._watcher = this
    }
    // 该组件实例的观察者都会被添加到该组件实例对象的 vm._watchers 数组中，包括渲染函数的观察者和非渲染函数的观察者。vm._watchers 属性是在 initState 函数中初始化的，其初始值是一个空数组。
    vm._watchers.push(this)
    // options
    if (options) {
      // 用来告诉当前观察者实例对象是否是深度观测
      this.deep = !!options.deep
      // 用来标识当前观察者实例对象是 开发者定义的 还是 内部定义的,除了内部定义的观察者(如：渲染函数的观察者、计算属性的观察者等)之外，所有观察者都被认为是开发者定义的，这时 options.user 会自动被设置为 true。
      this.user = !!options.user
      this.lazy = !!options.lazy
      // 用来告诉观察者当数据变化时是否同步求值并执行回调,默认情况下当数据变化时不会同步求值并执行回调，而是将需要重新求值并执行回调的观察者放到一个异步队列中，当所有数据的变化结束之后统一求值并执行回调
      this.sync = !!options.sync
      // 可以理解为 Watcher 实例的钩子，当数据变化之后，触发更新之前，调用在创建渲染函数的观察者实例对象时传递的 before 选项。
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    // 观察者实例对象的唯一标识
    this.id = ++uid // uid for batching
    // 标识着该观察者实例对象是否是激活状态，默认值为 true 代表激活
    this.active = true
    // 只有计算属性的观察者实例对象的 this.dirty 属性的值为true才会为真，因为计算属性是惰性求值。
    this.dirty = this.lazy // for lazy watchers
    // this.deps 与 this.depIds 为一组，this.newDeps 与 this.newDepIds 为一组。
    // 其中 this.deps 与 this.newDeps 被初始化为空数组，而 this.depIds 与 this.newDepIds 被初始化为 Set 实例对象。
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // parsePath 函数定义在 src/core/util/lang.js 文件
      // parsePath 函数的返回值是另一个函数，那么返回的新函数的作用是什么呢？很显然其作用是触发 'obj.a' 的 get 拦截器函数，同时新函数会将 'obj.a' 的值返回。
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // this.value 属性保存着被观察目标的值。
    this.value = this.lazy
      ? undefined
      // this.get() 是我们遇到的第一个观察者对象的实例方法，它的作用可以用两个字描述：求值
      // 求值的目的有两个，第一个是能够触发访问器属性的 get 拦截器函数，第二个是能够获得被观察目标的值。
      : this.get()
  }
  // 构造函数结束

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 一上来调用了 pushTarget(this) 函数，并将当前观察者实例对象作为参数传递，这里的 pushTarget 函数来自于 src/core/observer/dep.js 文件
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 作用就是用来 避免收集重复依赖 的，既然是用来避免收集重复的依赖
    if (!this.newDepIds.has(id)) {
      // newDepIds 属性用来避免在 一次求值 的过程中收集重复的依赖，其实 depIds 属性是用来在 多次求值 中避免收集重复依赖的。
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // depIds 属性是用来在 多次求值 中避免收集重复依赖的。什么是多次求值，其实所谓多次求值是指当数据变化时重新求值的过程。大家可能会疑惑，难道重新求值的时候不能用 newDepIds 属性来避免收集重复的依赖吗？不能，原因在于每一次求值之后 newDepIds 属性都会被清空，也就是说每次重新求值的时候对于观察者实例对象来讲 newDepIds 属性始终是全新的。
      // 虽然每次求值之后会清空 newDepIds 属性的值，但在清空之前会把 newDepIds 属性的值以及 newDeps 属性的值赋值给 depIds 属性和 deps 属性，这样重新求值的时候 depIds 属性和 deps 属性将会保存着上一次求值中 newDepIds 属性以及 newDeps 属性的值。
      // 为了证明这一点，我们来看一下观察者对象的求值方法，即 get() 方法中的this.cleanupDeps()

      // 通过以上三点内容我们可以总结出一个结论，即 newDepIds 和 newDeps 这两个属性的值所存储的总是当次求值所收集到的 Dep 实例对象，而 depIds 和 deps 这两个属性的值所存储的总是上一次求值过程中所收集到的 Dep 实例对象。
      if (!this.depIds.has(id)) {
        // addSub 方法接收观察者对象作为参数，并将接收到的观察者添加到 Dep 实例对象的 subs 数组中，其实 addSub 方法才是真正用来收集观察者的方法，并且收集到的观察者都会被添加到 subs 数组中存起来。
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
