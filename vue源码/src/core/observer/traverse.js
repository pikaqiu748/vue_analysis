/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 我们知道既然是深度观测，所以被观察属性的值要么是一个对象要么是一个数组，并且该值不能是冻结的，同时也不应该是 VNode 实例(这是Vue单独做的限制)。只有当被观察属性的值满足这些条件时，才会对其进行深度观测，只要有一项不满足 _traverse 就会 return 结束执行。
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 下面的if解决了循环引用导致死循环的问题
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    // 如果一个响应式数据是对象或数组，那么它会包含一个叫做 __ob__ 的属性，这时我们读取 val.__ob__.dep.id 作为一个唯一的ID值，并将它放到 seenObjects 中：seen.add(depId)
    seen.add(depId)
  }
  // 这段代码将检测被观察属性的值是数组还是对象，无论是数组还是对象都会通过 while 循环对其进行遍历，并递归调用 _traverse 函数，这段代码的关键在于递归调用 _traverse 函数时所传递的第一个参数：val[i] 和 val[keys[i]]。这两个参数实际上是在读取子属性的值，这将触发子属性的 get 拦截器函数，保证子属性能够收集到观察者，仅此而已。
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
