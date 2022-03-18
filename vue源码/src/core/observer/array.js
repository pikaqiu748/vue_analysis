/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */
// 该文件只做了一件事情，那就是导出 arrayMethods 对象：
import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)
// arrayMethods 对象的原型是真正的数组构造函数的原型。接着定义了 methodsToPatch 常量：
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
// 该循环的主要目的就是使用 def 函数在 arrayMethods 对象上定义与数组变异方法同名的函数，从而做到拦截的目的，
methodsToPatch.forEach(function (method) {
  // 首先缓存了数组原本的变异方法：
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 将数组原本变异方法的返回值赋值给 result 常量，并且我们发现函数体的最后一行代码将 result作为返回值返回。这就保证了拦截函数的功能与数组原本变异方法的功能是一致的。
    const result = original.apply(this, args)
    // 下面的 this 其实就是数组实例本身，我们知道无论是数组还是对象，都将会被定义一个 __ob__ 属性，并且 __ob__.dep 中收集了所有该对象(或数组)的依赖(观察者)。所以上面两句代码的目的其实很简单，当调用数组变异方法时，必然修改了数组，所以这个时候需要将该数组的所有依赖(观察者)全部拿出来执行，即：ob.dep.notify()。
    const ob = this.__ob__
    let inserted
    // 需要重点关注的是增加元素的操作，即 push、unshift 和 splice，这三个变异方法都可以为数组添加新的元素，那么为什么要重点关注呢？原因很简单，因为新增加的元素是非响应式的，所以我们需要获取到这些新元素，并将其变为响应式数据才行，而这就是上面代码的目的。
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      // 我们知道 splice 函数从第三个参数开始到最后一个参数都是数组的新增元素，所以直接使用 args.slice(2) 作为 inserted 的值即可。最后 inserted 变量中所保存的就是新增的数组元素，我们只需要调用 observeArray 函数对其进行观测即可：
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
