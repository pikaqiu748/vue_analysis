/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 将key代理到vue实例上
// 传过来的是vm _data  data中的每个key值
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 响应式原理入口
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 对props配置做响应式处理
  // 代理props配置上的Key到vue实例，支持this.propKey的方式访问
  // 注意到 props 选项的初始化要早于 data 选项的初始化，那么这是不是可以使用 props 初始化 data 数据的原因呢？答案是：“是的”。
  if (opts.props) initProps(vm, opts.props)
  // props中的key优先级高于methods中key，即methods中的key不嗯呢该和prop中的key重复。
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    // 对data做响应式处理
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  // watch 选项仅仅判断 opts.watch 是否存在是不够的，还要判断 opts.watch 是不是原生的 watch 对象。
  // 是因为在 Firefox 中原生提供了 Object.prototype.watch 函数，所以即使没有 opts.watch 选项，如果在火狐浏览器中依然能够通过原型链访问到原生的 Object.prototype.watch,但这其实不是我们想要的结果，所以这里加了一层判断避免把原生 watch 函数误认为是我们预期的 opts.watch 选项。之后才会调用 initWatch 函数初始化 opts.watch 选项。
  if (opts.watch && opts.watch !== nativeWatch) {
    // initWatch 函数，它就定义在 createWatcher 函数的上方
    initWatch(vm, opts.watch)
  }
  // computed和watch有什么区别？
  // 1.computed默认懒执行且不可更改，但是watcher可以配置
  // 使用场景不同
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
        config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 对props数据做响应式处理
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      // 代理props的key
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  // 保证data是对象,“通过调用 data 选项从而获取数据对象”。
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 使用 isPlainObject 函数判断变量 data 是不是一个纯对象，如果不是纯对象那么在非生产环境会打印警告信息。我们知道，如果一切都按照预期进行，那么此时 data 已经是一个最终的数据对象了，但这仅仅是我们的期望而已，毕竟 data 选项是开发者编写的，如下：
  // new Vue({
  //   data () {
  //     return '我就是不返回对象'
  //   }
  // })
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // while做判重处理，data中的属性不能和props和methods中的属性重复
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // props优先级 > data优先级 > methods优先级。
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
      // 在 core/util 目录下的工具方法全解 中查看对于 isReserved 函数的讲解。
      // !isReserved(key)，该条件的意思是判断定义在 data 中的 key 是否是保留键，大家可以在 core/util 目录下的工具方法全解 中查看对于 isReserved 函数的讲解。isReserved 函数通过判断一个字符串的第一个字符是不是 $或 _ 来决定其是否是保留的，Vue 是不会代理那些键名以 $ 或 _ 开头的字段的，因为 Vue 自身的属性和方法都是以 $ 或 _ 开头的，所以这么做是为了避免与 Vue 自身的属性和方法相冲突。
    } else if (!isReserved(key)) {
      // 进行代理，从而支持this.key的方式访问data中的数据
      // 该函数同样定义在 core/instance/state.js 文件中
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 根据 vm.$options.data 选项获取真正想要的数据（注意：此时 vm.$options.data 是函数）
  // 校验得到的数据是否是一个纯对象
  // 检查数据对象 data 上的键是否与 props 对象上的键冲突
  // 检查 methods 对象上的键是否与 data 对象上的键冲突
  // 在 Vue 实例对象上添加代理访问数据对象的同名属性
  // 最后调用 observe 函数开启响应式之路
  // 可以看到在调用 observe 观测 data 对象的时候 asRootData 参数为 true。而在后续的递归观测中调用 observe 的时候省略了 asRootData 参数。所以所谓的根数据对象就是 data 对象
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  // getData 函数接收两个参数：第一个参数是 data 选项，我们知道 data 选项是一个函数，第二个参数是 Vue 实例对象。getData 函数的作用其实就是通过调用 data 函数获取真正的数据对象并返回，即：data.call(vm, vm)，而且我们注意到 data.call(vm, vm) 被包裹在 try...catch 语句块中，这是为了捕获 data 函数中可能出现的错误。同时如果有错误发生那么则返回一个空对象作为数据对象：return {}。
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // 其中 watchers 常量与组件实例的 vm._computedWatchers 属性拥有相同的引用，且初始值都是通过 Object.create(null) 创建的空对象，
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 遍历computed对象
  for (const key in computed) {
    // 定义了 userDef 常量，它的值是计算属性对象中相应的属性值，我们知道计算属性有两种写法，计算属性可以是一个函数，还可以是对象:
    // computed: {
    //   someComputedProp: {
    //     get: function () {
    //       return this.a + 1
    //     },
    //     set: function (v) {
    //       this.a = v - 1
    //     }
    //   }
    // }
    const userDef = computed[key]
    // 如果计算属性使用函数的写法，那么 getter 常量的值就是 userDef 本身，即函数。如果计算属性使用的是对象写法，那么 getter 的值将会是 userDef.get 函数。总之 getter 常量总会是一个函数。
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 在非生产环境下如果发现 getter 不存在，则直接打印警告信息，提示你计算属性没有对应的 getter。也就是说计算属性的函数写法实际上是对象写法的简化，如下这两种写法是等价的：
    // computed: {
    //   someComputedProp () {
    //     return this.a + this.b
    //   }
    // }
    // // 等价于
    // computed: {
    //   someComputedProp: {
    //     get () {
    //       return this.a + this.b
    //     }
    //   }
    // }
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    // 只有在非服务端渲染时才会执行 if 语句块内的代码，因为服务端渲染中计算属性的实现本质上和使用 methods 选项差不多
    if (!isSSR) {
      // create internal watcher for the computed property.
      // 实例化一个watcher,所以computed原理其实就是通过watcher实现的
      // 在 if 语句块内创建了一个观察者实例对象，我们称之为 计算属性的观察者,同时会把计算属性的观察者添加到 watchers 常量对象中，键值是对应计算属性的名字，注意由于 watchers 常量与 vm._computedWatchers 属性具有相同的引用，所以对 watchers 常量的修改相当于对 vm._computedWatchers 属性的修改，现在你应该知道了，vm._computedWatchers 对象是用来存储计算属性观察者的。
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        // 懒执行，true
        computedWatcherOptions
      )
      // 首先创建计算属性观察者时所传递的第二个参数是 getter 函数，也就是说计算属性观察者的求值对象是 getter 函数。传递的第四个参数是 computedWatcherOptions 常量，它是一个对象，定义在 initComputed 函数的上方：const computedWatcherOptions = { computed: true },，通过如上这句代码可知在创建计算属性观察者对象时 computed 选项为 true，它的作用就是用来标识一个观察者对象是计算属性的观察者，计算属性的观察者与非计算属性的观察者的行为是不一样的。
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 这段代码首先检查计算属性的名字是否已经存在于组件实例对象中，我们知道在初始化计算属性之前已经初始化了 props、methods 和 data 选项，并且这些选项数据都会定义在组件实例对象上，由于计算属性也需要定义在组件实例对象上，所以需要使用计算属性的名字检查组件实例对象上是否已经有了同名的定义，如果该名字已经定义在组件实例对象上，那么有可能是 data 数据或 props 数据或 methods 数据之一，对于 data 和 props 来讲他们是不允许被 computed 选项中的同名属性覆盖的，
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 的值与 initComputed 函数中定义的 isSSR 常量的值是取反的关系，也是一个布尔值，用来标识是否应该缓存值，也就是说只有在非服务端渲染的情况下计算属性才会缓存值。
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    // 另外由于在这个if分支中， userDef 是函数，这说明该计算属性并没有指定 set 拦截器函数，所以直接将其设置为空函数 noop：sharedPropertyDefinition.set = noop。
    sharedPropertyDefinition.set = noop
  } else {
    // 如果代码走到了 else 分支，那说明 userDef 是一个对象，
    // 无论 userDef 是函数还是对象，在非服务端渲染的情况下，配置对象 sharedPropertyDefinition 最终将变成如下这样：
    // sharedPropertyDefinition = {
    //   enumerable: true,
    //   configurable: true,
    //   get: createComputedGetter(key),
    //   set: userDef.set // 或 noop
    // }
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  // 在非生产环境下如果发现 sharedPropertyDefinition.set 的值是一个空函数，那么说明开发者并没有为计算属性定义相应的 set 拦截器函数，这时会重写 sharedPropertyDefinition.set 函数，这样当你在代码中尝试修改一个没有指定 set 拦截器函数的计算属性的值时，就会得到一个警告信息。
  if (process.env.NODE_ENV !== 'production' &&
    sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 将computed中的配置项代理到vue实例上那个，支持通过this.computedKey的方式去访问computed中的属性
  // defineComputed 函数的最后一句代码可知，该函数的作用就是通过 Object.defineProperty 函数在组件实例对象上定义与计算属性同名的组件实例属性，而且是一个访问器属性，属性的配置参数是 sharedPropertyDefinition 对象，defineComputed 函数中除最后一句代码之外的所有代码都是用来完善 sharedPropertyDefinition 对象的。
  // sharedPropertyDefinition = {
  //   enumerable: true,
  //   configurable: true,
  //   get: function computedGetter () {
  //     const watcher = this._computedWatchers && this._computedWatchers[key]
  //     if (watcher) {
  //       watcher.depend()
  //       return watcher.evaluate()
  //     }
  //   },
  //   set: noop // 没有指定 userDef.set 所以是空函数
  // }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  // createComputedGetter 函数只是返回一个叫做 computedGetter 的函数，也就是说计算属性真正的 get 拦截器函数就是 computedGetter 函数，
  return function computedGetter () {
    // 拿到watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        // 执行computed.key的值（函数）得到函数的执行结果，赋值给watcher.value
        // 将watcher.dirty置为fasle，
        // computed和methods有什么区别?
        // computed有缓存
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker (fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // 这段代码用来检测该方法是否真正的有定义，如果没有定义则打印警告信息，提示开发者是否正确地引用了函数。
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 其中 props 常量定义在 initMethods 函数开头
      if (props && hasOwn(props, key)) {
        // props中的key不能和methods中的key相同
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 上面代码中首先检测方法名字 key 是否已经在组件实例对象 vm 中有了定义，并且该名字 key 为保留的属性名，什么是保留的属性名呢？根据 isReserved 函数可知以字符 $ 或 _ 开头的名字为保留名，如果这两个条件都成立，说明你定义的方法与 Vue 原生提供的内置方法冲突
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 通过这句代码可知，之所以能够通过组件实例对象访问 methods 选项中定义的方法，就是因为在组件实例对象上定义了与 methods 选项中所定义的同名方法，当然了在定义到组件实例对象之前要检测该方法是否真正的有定义：methods[key] == null，如果没有则添加一个空函数到组件实例对象上。
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 可以看到 initWatch 函数就是通过对 watch 选项遍历，然后通过 createWatcher 函数创建观察者对象的
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    // 通过这个条件我们可以发现 handler 常量可以是一个数组，它的值是 watch[key]，也就是说我们在使用 watch 选项时可以通过传递数组来实现创建多个观察者
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 在 $watch 方法中已经检测过参数 cb 是否是纯对象了，这里又检测了一次是否多此一举？”，其实这么做并不是多余的，因为 createWatcher 函数除了在 $watch 方法中使用之外，还会用于 watch 选项，而这时就需要对 handler 进行检测。
  if (isPlainObject(handler)) {
    // 总之如果 handler 是一个纯对象，那么就将变量 handler 的值赋给 options 变量，然后用 handler.handler 的值重写 handler 变量的值。举个例子，如下代码所示：
    // vm.$watch('name', {
    //   handler () {
    //     console.log('change')
    //   },
    //   immediate: true
    // })
    // 如果你像如上代码那样使用 $watch 方法，那么对于 createWatcher 函数来讲，其 handler 参数为：
    // handler = {
    //   handler () {
    //     console.log('change')
    //   },
    //   immediate: true
    // }
    // 等价于：
    // if (isPlainObject(handler)) {
    //   options = {
    //     handler () {
    //       console.log('change')
    //     },
    //     immediate: true
    //   }
    //   handler = handler () {
    //     console.log('change')
    //   }
    // }
    // 这样就可正常通过 $watch 方法创建观察者了
    options = handler
    handler = handler.handler
  }
  //这段代码说明 handler 除了可以是一个纯对象还可以是一个字符串，当 handler 是一个字符串时，会读取组件实例对象的 handler 属性的值并用该值重写 handler 的值。
  // watch: {
  //   name: 'handleNameChange'
  // },
  // methods: {
  //   handleNameChange () {
  //     console.log('name change')
  //   }
  // }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  // 如果不是生产环境的话，就为 $data 和 $props 这两个属性设置一下 set，实际上就是提示你一下：别他娘的想修改我，老子无敌。
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 使用 Object.defineProperty 在 Vue.prototype 上定义了两个属性，就是大家熟悉的：$data 和 $props，这两个属性的定义分别写在了 dataDef 以及 propsDef 这两个对象里
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 据文件头部的引用关系可知 set 和 del 来自 src/core/observer/index.js 文件中定义的 set 函数和 del 函数。
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // $watch 方法允许我们观察数据对象的某个属性，当属性变化时执行回调。所以 $watch 方法至少接收两个参数，一个要观察的属性，以及一个回调函数。通过上面的代码我们发现，$watch 方法接收三个参数，除了前面介绍的两个参数之后还接收第三个参数，它是一个选项参数，比如是否立即执行回调或者是否深度观测等。我们可以发现这三个参数与 Watcher 类的构造函数中的三个参数相匹配,因为 $watch 方法的实现本质就是创建了一个 Watcher 实例对象。另外通过官方文档的介绍可知 $watch 方法的第二个参数既可以是一个回调函数，也可以是一个纯对象，这个对象中可以包含 handler 属性，该属性的值将作为回调函数，同时该对象还可以包含其他属性作为选项参数，如 immediate 或 deep。
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 处理cb是对象的情况，保证后面的cb肯定是一个函数
    if (isPlainObject(cb)) {
      // 当参数 cb 不是函数，而是一个纯对象，则会调用 createWatcher 函数，并将参数透传，注意还多传递给 createWatcher 函数一个参数，即组件实例对象 vm，那么 createWatcher 函数做了什么呢？createWatcher 函数也定义在 src/core/instance/state.js 文件中
      return createWatcher(vm, expOrFn, cb, options)
    }
    // 首先如果没有传递 options 选项参数，那么会给其一个默认的空对象，接着将 options.user 的值设置为 true，我们前面讲到过这代表该观察者实例是用户创建的，然后就到了关键的一步，即创建 Watcher 实例对象，
    options = options || {}
    // 标记这是一个用户user
    options.user = true

    const watcher = new Watcher(vm, expOrFn, cb, options)
    //  immediate 选项用来在属性或函数被侦听后立即执行回调，如上代码就是其实现原理，如果发现 options.immediate 选项为真，那么会执行回调函数，不过此时回调函数的参数只有新值没有旧值。同时取值的方式是通过前面创建的观察者实例对象的 watcher.value 属性。我们知道观察者实例对象的 value 属性，保存着被观察属性的值。
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 最后 $watch 方法还有一个返回值，如下：
    // $watch 函数返回一个函数，这个函数的执行会解除当前观察者对属性的观察。它的原理是通过调用观察者实例对象的 watcher.teardown 函数实现的。我们可以看一下 watcher.teardown 函数是如何解除观察者与属性之间的关系的，如下是 teardown 函数的代码：
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
