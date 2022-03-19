/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 首先注意一点：无论是对象还是数组，都将通过 def 函数为其定义 __ob__ 属性
    def(value, '__ob__', this)
    // 处理数组响应式
    if (Array.isArray(value)) {
      // 因为 __proto__ 属性是在 IE11+ 才开始支持，所以如果是低版本的 IE 怎么办？比如 IE9/10，所以出于兼容考虑，我们需要做能力检测，如果当前环境支持 __proto__ 时我们就采用上述方式来实现对数组变异方法的拦截，如果当前环境不支持 __proto__ 那我们就需要另想办法了，
      if (hasProto) {
        // 修改数组的原型链,可以通过设置数组实例的 __proto__ 属性，让其指向一个代理原型，从而做到拦截。
        // src/core/observer/array.js 文件： arrayMethods 是如何实现的
        protoAugment(value, arrayMethods)
      } else {
        // 以上是在当前环境支持 __proto__ 属性的情况，如果不支持则 augment 的值为 copyAugment 函数，copyAugment 定义在 protoAugment 函数的下方：
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 但是如果数组中嵌套了其他的数组或对象，那么嵌套的数组或对象却不是响应的，为了使嵌套的数组或对象同样是响应式数据，我们需要递归的观测那些类型为数组或对象的数组元素，而这就是 observeArray 方法的作用
      this.observeArray(value)
    } else {
      // 处理普通对象响应式
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // observeArray 方法的实现很简单，只需要对数组进行遍历，并对数组元素逐个应用 observe工厂函数即可，这样就会递归观测数组元素了。
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
// 传过来的value是数组。
// copyAugment(value, arrayMethods, arrayKeys)
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  // 我们知道 copyAugment 函数的第三个参数 keys 就是定义在 arrayMethods 对象上的所有函数的键，即所有要拦截的数组变异方法的名称。这样通过 for 循环对其进行遍历,并使用 def 函数在数组实例上定义与数组变异方法同名的且不可枚举的函数，这样就实现了拦截操作。
  // 总之无论是 protoAugment 函数还是 copyAugment 函数，他们的目的只有一个：把数组实例与代理原型或与代理原型中定义的函数联系起来，从而拦截数组变异方法。
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// observe方法应该算是Observer的守护，为Observer即将开启前做的一些合规检测.
// 第二个参数指示着被观测的数据对象是否是根数据对象,，什么叫根数据对象呢？
// 在 src/core/instance/state.js 文件中的initData()函数中
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  // 可以发现，根数据对象将有用一个特质，即 target.__ob__.vmCount > 0，这样条件 (ob && ob.vmCount) 是成立的，也就是说：当使用 Vue.set/$set 函数为根数据对象添加属性时，是不被允许的。
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化一个dep,一个key对应一个dep
  const dep = new Dep()

  // 获取属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set

  // 下面if条件的解释具体详细解释查看：https://blog.csdn.net/nicexibeidage/article/details/82112143
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 通过递归的方式处理val为对象的情况，即处理嵌套对象，
  // if shallow为FALSE，则不会进行深度响应.
  // 由于在 walk 函数中调用 defineReactive 函数时没有传递 shallow 参数，所以该参数是 undefined，那么也就是说默认就是深度观测,即!undefined为true。
  // 非深度观测的场景我们早就遇到过了，即 initRender 函数中在 Vue 实例对象上定义 $attrs 属性和 $listeners 属性时就是非深度观测，如下：
  let childOb = !shallow && observe(val)
  // 拦截object[key]的访问和设置
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 拦截Obj.key
    get: function reactiveGetter () {
      // 首先判断是否存在 getter，我们知道 getter 常量中保存的属性原型的 get 函数，如果 getter 存在那么直接调用该函数，并以该函数的返回值作为属性的值，保证属性的原有读取操作正常运作。
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        // dep.depend()，执行 dep 对象的 depend 方法将依赖收集到 dep 这个“筐”中，这里的 dep 对象就是属性的 getter/setter 通过闭包引用的“筐”。
        dep.depend()
        //  childOb 是什么？假设有如下数据对象：
        // const data = {
        //   a: {
        //     b: 1
        //   }
        // }
        // 该数据对象经过观测处理之后，将被添加 __ob__ 属性，如下：
        // const data = {
        //   a: {
        //     b: 1,
        //     __ob__: {value, dep, vmCount}
        //   },
        //   __ob__: {value, dep, vmCount}
        // }
        // 对于属性 a 来讲，访问器属性 a 的 setter/getter 通过闭包引用了一个 Dep 实例对象，即属性 a 用来收集依赖的“筐”。除此之外访问器属性 a 的 setter/getter 还闭包引用着 childOb，且 childOb === data.a.__ob__ 所以 childOb.dep === data.a.__ob__.dep。
        // 也就是说 childOb.dep.depend() 这句话的执行说明除了要将依赖收集到属性 a 自己的“筐”里之外，还要将同样的依赖收集到 data.a.__ob__.dep 这里”筐“里，为什么要将同样的依赖分别收集到这两个不同的”筐“里呢？其实答案就在于这两个”筐“里收集的依赖的触发时机是不同的，即作用不同，两个”筐“如下：
        // 第一个”筐“是 dep
        // 第二个”筐“是 childOb.dep

        // 第一个”筐“里收集的依赖的触发时机是当属性值被修改时触发，即在 set 函数中触发：dep.notify()。而第二个”筐“里收集的依赖的触发时机是在使用 $set 或 Vue.set 给数据对象添加新属性时触发，我们知道由于 js 语言的限制，在没有 Proxy 之前 Vue 没办法拦截到给对象添加属性的操作。所以 Vue 才提供了 $set 和 Vue.set 等方法让我们有能力给对象添加新属性的同时触发依赖，那么触发依赖是怎么做到的呢？就是通过数据对象的 __ob__ 属性做到的。因为 __ob__.dep 这个”筐“里收集了与 dep 这个”筐“同样的依赖。假设 Vue.set 函数代码如下：
        // Vue.set = function (obj, key, val) {
        //   defineReactive(obj, key, val)
        //   obj.__ob__.dep.notify()
        // }
        // 如上代码所示，当我们使用上面的代码给 data.a 对象添加新的属性：Vue.set(data.a, 'c', 1)
        // Vue.set = function (obj, key, val) {
        //   defineReactive(obj, key, val)
        //   obj.__ob__.dep.notify() // 相当于 data.a.__ob__.dep.notify()
        // }

        // Vue.set(data.a, 'c', 1)
        // 所以 __ob__ 属性以及 __ob__.dep 的主要作用是为了添加、删除属性时有能力触发依赖，而这就是 Vue.set 或 Vue.delete 的原理。

        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // {
            //   arr: [
            //     { a: 1, __ob__ /* 我们将该 __ob__ 称为 ob2 */ },    __ob__ /* 我们将该 __ob__ 称为 ob1 */  ]
            // }
            //我们使用 $set 函数为 arr 数组的第一对象元素添加了一个属性 b，这是触发不了响应的。为了能够使得这段代码可以触发响应，就必须让 ob2 收集到依赖，而这就是 dependArray 函数的作用。如下是 dependArray 函数的代码：
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 在文件 src/core/instance/state.js中使用了下面的两个函数, src/core/global-api/index.js 中也是引用的这两个
export function set (target: Array<any> | Object, key: any, val: any): any {
  // isUndef 函数用来判断一个值是否是 undefined 或 null，如果是则返回 true，isPrimitive 函数用来判断一个值是否是原始类型值，如果是则返回 true。这么做是合理的，因为理论上只能为对象(或数组)添加属性(或元素)。
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 这段代码对 target 和 key 这两个参数做了校验，如果 target 是一个数组，并且 key 是一个有效的数组索引，那么就会执行 if 语句块的内容。
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 原理其实很简单，我们知道数组的 splice 变异方法能够完成数组元素的删除、添加、替换等操作。而 target.splice(key, 1, val) 就利用了替换元素的能力，将指定位置元素的值替换为新值，同时由于 splice 方法本身是能够触发响应的，所以一切看起来如此简单。
    target.length = Math.max(target.length, key)
    // 注意 splice 方法本身是能够触发响应的,
    target.splice(key, 1, val)
    return val
  }
  // 如果 target 不是一个数组，那么必然就是纯对象了，当给一个纯对象设置属性的时候，假设该属性已经在对象上有定义了，那么只需要直接设置该属性的值即可，这将自动触发响应，因为已存在的属性是响应式的。但这里要注意的是 if 语句的两个条件保证了 key 在 target 对象上，或在 target 的原型链上，同时必须不能在 Object.prototype 上
  // 如果是对象本身的属性，则直接添加即可。
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 如果代码运行到了这里，那说明正在给对象添加一个全新的属性
  const ob = (target: any).__ob__
  //  Vue 实例对象拥有 _isVue 属性，所以当第一个条件成立时，那么说明你正在使用 Vue.set/$set 函数为 Vue 实例对象添加属性，为了避免属性覆盖的情况出现，Vue.set/$set 函数不允许这么做，在非生产环境下会打印警告信息。从observe函数中可以发现，只有根数据才有vmCount>0这一属性.
  // 为什么不允许在根数据对象上添加属性呢？因为这样做是永远触发不了依赖的。原因就是根数据对象的 Observer 实例收集不到依赖(观察者).即不会直接使用根数据，只会引用里面的数据
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // target 也许原本就是非响应的，这个时候 target.__ob__是不存在的，所以当发现 target.__ob__ 不存在时，就简单的赋值即可。
  if (!ob) {
    target[key] = val
    return val
  }
  // 这两个条件保证了 key 在 target 对象上，或在 target 的原型链上，同时必须不能在 Object.prototype 上。
  defineReactive(ob.value, key, val)
  // 调用了 __ob__.dep.notify() 从而触发响应。这就是添加全新属性触发响应的原理。
  ob.dep.notify()
  return val
}

// Vue 是没有能力拦截到为一个对象(或数组)添加属性(或元素)的，而 Vue.set 和 Vue.delete 就是为了解决这个问题而诞生的。同时为了方便使用 Vue 还在实例对象上定义了 $set 和 $delete 方法，实际上 $set 和 $delete 方法仅仅是 Vue.set 和 Vue.delete 的别名，

// del 函数接收两个参数，分别是将要被删除属性的目标对象 target 以及要删除属性的键名 key
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  // 与不能使用 Vue.set/$set 函数为根数据或 Vue 实例对象添加属性一样，同样不能使用 Vue.delete/$delete 删除 Vue 实例对象或根数据的属性。不允许删除 Vue 实例对象的属性，是出于安全因素的考虑。而不允许删除根数据对象的属性，是因为这样做也是触发不了响应的，关于触发不了响应的原因，我们在讲解 Vue.set/$set 时已经分析过了。
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 首先使用 hasOwn 函数检测 key 是否是 target 对象自身拥有的属性，如果不是那么直接返回(return)。很好理解，如果你将要删除的属性原本就不在该对象上，那么自然什么都不需要做。
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  // 如果 key 存在于 target 对象上，那么代码将继续运行，此时将使用 delete 语句从 target 上删除属性 key。最后判断 ob 对象是否存在，如果不存在说明 target 对象原本就不是响应的，所以直接返回(return)即可。如果 ob 对象存在，说明 target 对象是响应的，需要触发响应才行，即执行 ob.dep.notify()。
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */

// 该函数将通过 for 循环遍历数组，并取得数组每一个元素的值，如果该元素的值拥有 __ob__ 对象和 __ob__.dep 对象，那说明该元素也是一个对象或数组，此时只需要手动执行 __ob__.dep.depend() 即可达到收集依赖的目的。
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      // 同时如果发现数组的元素仍然是一个数组，那么需要递归调用 dependArray 继续收集依赖。
      // 我们试图修改 arr 数组的第一个元素，但这么做是触发不了响应的，因为对于数组来讲，其索引并不是“访问器属性”。正是因为数组的索引不是”访问器属性“，所以当有观察者依赖数组的某一个元素时是触发不了这个元素的 get 函数的当然也就收集不到依赖。这个时候就是 dependArray 函数发挥作用的时候了。
      dependArray(e)
    }
  }
}
