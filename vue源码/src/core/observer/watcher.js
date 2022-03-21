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
        // traverse 函数的作用就是递归地读取被观察属性的所有子属性的值，这样被观察属性的所有子属性都将会收集到观察者，从而达到深度观测的目的。
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
    // 其实 deps 属性还能够用来移除废弃的观察者，cleanupDeps 方法中开头的那段 while 循环就是用来实现这个功能的，也就是对上一次求值所收集到的 Dep 对象进行遍历，然后在循环内部检查上一次求值所收集到的 Dep 实例对象是否存在于当前这次求值所收集到的 Dep 实例对象中，如果不存在则说明该 Dep 实例对象已经和该观察者不存在依赖关系了，这时就会调用 dep.removeSub(this) 方法并以该观察者实例对象作为参数传递，从而将该观察者对象从 Dep 实例对象中移除。
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        //  remove 工具函数，将该观察者从 this.subs 数组中移除。其中 remove 工具函数来自 src/shared/util.js 文件
        dep.removeSub(this)
      }
    }
    // 即 newDepIds 和 newDeps 这两个属性的值所存储的总是当次求值所收集到的 Dep 实例对象，而 depIds 和 deps 这两个属性的值所存储的总是上一次求值过程中所收集到的 Dep 实例对象。
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
      // this.sync 属性的值就是创建观察者实例对象时传递的第三个选项参数中的 sync 属性的值，这个值的真假代表了当变化发生时是否同步更新变化。对于渲染函数的观察者来讲，它并不是同步更新变化的，而是将变化放到一个异步更新队列中，也就是 else 语句块中代码所做的事情，即 queueWatcher,会将当前观察者对象放到一个异步更新队列，这个队列会在调用栈被清空之后按照一定的顺序执行
    } else if (this.sync) {
      // 只需要知道一件事情，那就是无论是同步更新变化还是将更新变化的操作放到异步更新队列，真正的更新变化操作都是通过调用观察者实例对象的 run 方法完成的。所以此时我们应该把目光转向 run 方法，
      this.run()
    } else {
      // 如果没有指定这个观察者是同步更新(this.sync 为真)，那么这个观察者的更新机制就是异步的，这时当调用观察者对象的 update 方法时，在 update 方法内部会调用 queueWatcher 函数，并将当前观察者对象作为参数传递，
      // queueWatcher 函数来自 src/core/observer/scheduler.js 文件
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // this.active 属性用来标识一个观察者是否处于激活状态，或者可用状态。如果观察者处于激活状态那么 this.active 的值为真，此时会调用观察者实例对象的 getAndInvoke 方法，并以 this.cb 作为参数，我们知道 this.cb 属性是一个函数，我们称之为回调函数，当变化发生时会触发，但是对于渲染函数的观察者来讲，this.cb 属性的值为 noop，即什么都不做。
  run () {
    if (this.active) {
      // 重新求值其实等价于重新执行渲染函数，最终结果就是重新生成了虚拟DOM并更新真实DOM，这样就完成了重新渲染的过程。
      const value = this.get()
      if (
        // 对于渲染函数的观察者来讲并不会执行这个 if 语句块，因为 this.get 方法的返回值其实就等价于 updateComponent 函数的返回值，这个值将永远都是 undefined
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
          // 如果观察者对象的 this.user 为真意味着这个观察者是开发者定义的，所谓开发者定义的是指那些通过 watch 选项或 $watch 函数定义的观察者，这些观察者的特点是回调函数是由开发者编写的，所以这些回调函数在执行的过程中其行为是不可预知的，很可能出现错误，这时候将其放到一个 try...catch 语句块中，这样当错误发生时我们就能够给开发者一个友好的提示,并且我们注意到在提示信息中包含了 this.expression 属性，我们前面说过该属性是被观察目标(expOrFn)的字符串表示，这样开发者就能清楚的知道是哪里发生了错误。
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          // 将回调函数的作用域修改为当前 Vue 组件对象，然后传递了两个参数，分别是新值和旧值。
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
    // 首先检查 this.active 属性是否为真，如果为假则说明该观察者已经不处于激活状态，什么都不需要做，如果为真则会执行 if 语句块内的代码
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 每个组件实例都有一个 vm._isBeingDestroyed 属性，它是一个标识，为真说明该组件实例已经被销毁了，为假说明该组件还没有被销毁，所以以上代码的意思是如果组件没有被销毁，那么将当前观察者实例从组件实例对象的 vm._watchers 数组中移除， vm._watchers 数组中包含了该组件所有的观察者实例对象，所以将当前观察者实例对象从 vm._watchers 数组中移除是解除属性与观察者实例对象之间关系的第一步。
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      // 将观察者实例对象从 vm._watchers 数组中移除之后，会执行如下这段代码：
      // 一个属性与一个观察者建立联系之后，属性的 Dep 实例对象会收集到该观察者对象，同时观察者对象也会将该 Dep 实例对象收集，这是一个双向的过程，并且一个观察者可以同时观察多个属性，这些属性的 Dep 实例对象都会被收集到该观察者实例对象的 this.deps 数组中,
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 所以解除属性与观察者之间关系的第二步就是将当前观察者实例对象从所有的 Dep 实例对象中移除，实现方法就如上代码所示。
      // 将当前观察者实例对象的 active 属性设置为 false，代表该观察者对象已经处于非激活状态了：
      this.active = false
    }
  }
}
