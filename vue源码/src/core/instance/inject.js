/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  // 在 initProvide 函数内部首先定义了 provide 常量，它的值是 vm.$options.provide 选项的引用，
  const provide = vm.$options.provide
  if (provide) {
    // 我们知道 provide 选项可以是对象，也可以是一个返回对象的函数。所以在 if 语句块内使用 typeof 操作符检测 provide 常量的类型，如果是函数则执行该函数获取数据，否则直接将 provide 本身作为数据
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
  // 它本质上就是在组件实例对象上添加了 vm._provided 属性，并保存了用于子代组件的数据。
}

export function initInjections (vm: Component) {
  // 子组件中通过 inject 选项注入的数据其实是存放在其父代组件实例的 vm._provided 属性中，实际上 resolveInject 函数的作用就是根据当前组件的 inject 选项去父代组件中寻找注入的数据，并将最终的数据返回。
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 调用了 toggleObserving(false) 函数关闭了响应式定义的开关，之后又将开关开启：
    // 这么做将会导致使用 defineReactive 定义属性时不会将该属性的值转换为响应式的，所以 Vue 文档中提到了：
    // 提示：provide 和 inject 绑定并不是可响应的。这是刻意为之的。然而，如果你传入了一个可监听的对象，那么其对象的属性还是可响应的。
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        // 在非生产环境下调用 defineReactive 函数时会多传递一个参数，即 customSetter，当你尝试设置注入的数据时会提示你不要这么做。
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

// 在父组件中找到要inject的数据，具体看http://caibaojian.com/vue-design/art/9vue-state-init.html
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm
      // 接下来将开启一个 while 循环，用来查找注入数据的工作，如下
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      // 组件实例对象的 vm.$parent 属性为 null
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
