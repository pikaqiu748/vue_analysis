/* @flow */

import { warn } from './debug'
// 若文件引用的模块值改变，require 引入的模块值不会改变，而 import 引入的模块值会改变。
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // boolean casting
  // getTypeIndex 函数的作用准确地说是用来查找第一个参数所指定的类型构造函数是否存在于第二个参数所指定的类型构造函数数组中,
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // 上面这段代码的作用实际上是对 prop 的类型为布尔值时的特殊处理。
  // check default value
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    // 这段代码首先使用 prevShouldObserve 常量保存了之前的 shouldObserve 状态，紧接着将开关开启，使得 observe 函数能够将 value 定义为响应式数据，最后又还原了 shouldObserve 的状态。之所以这么做是因为取到的默认值是非响应式的，我们需要将其重新定义为响应式数据。
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    // 通过如上 if 语句的条件可知，仅在非生产环境下才会对 props 做类型校验，另外还有一个条件是用来跳过 weex 环境下某种条件的判断的，我们不做讲解。总之真正的校验工作是由 assertProp 函数完成的。
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
//  函数接收三个参数，分别是组件实例对象 vm、prop 的定义对象，以及 prop 的名字 key
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 在非生产环境下，如果你的 prop 默认值是对象类型，那么则会打印警告信息，告诉你需要用一个工厂函数返回这个对象类型的默认值，比如：
  // props: {
  //   prop1: {
  //     default () {
  //       return {
  //         a: 1
  //       }
  //     }
  //   },
  //   prop2: {
  //     default () {
  //       return [1, 2, 3]
  //     }
  //   }
  // }
  // 这么做的目的是防止多个组件实例共享一份数据所造成的问题。
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // def 常量为该 prop 的 default 属性的值，它代表了默认值，但是由于默认值可能是由工厂函数执行产生的，所以如果 def 的类型是函数则通过执行 def.call(vm) 来获取默认值，
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
// assertProp 函数接收五个参数，第一个参数 prop 为该prop的定义对象，第二个参数 name 是该 prop 的名字，第三个参数 value 是该 prop 的值，第四个参数 vm 为组件实例对象，第五个参数 absent 为一个布尔值代表外界是否向组件传递了该 prop 数据
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  // 这段代码的作用是用来做类型断言的，即判断外界传递的 prop 值的类型与期望的类型是否相符
  // 其中 !type 说明如果开发者在定义 prop 时没有规定该 prop 值的类型，则不需要校验，所以自然就认为无论外界传递了什么数据都是有效的，或者干脆在定义 prop 时直接将类型设置为 true，也代表不需要做 prop 校验。
  let valid = !type || type === true
  const expectedTypes = []
  // 只有当 type 存在时才需要做类型校验
  if (type) {
    // 检测 type 是否是一个数组，如果不是数组则将其包装成一个数组。然后开启一个 for 循环，该 for 循环用来遍历 type 数组
    if (!Array.isArray(type)) {
      type = [type]
    }
    // 所以一旦某个类型校验通过，那么 valid 的值将变为真，此时 for 循环内的语句将不再执行，这是因为该 prop 值的类型只要满足期望类型中的一个即可。
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  // 假设 for 循环遍历结束之后 valid 变量依然为假，则说明该 prop 值的类型不在期望的类型之中。
  // 如果代码运行到了这里，且 valid 的值为假，那么则打印警告信息提示开发者所传递的 prop 值的类型不符合预期。通过上面代码我们可以看到，在提示信息中通过打印 expectedTypes 数组中的类型字符串来提示开发者该 prop 所期望的类型。同时通过 toRawType 函数获取真正的 prop 值的类型，用来提示开发者所传递的值的类型是什么。最后函数直接返回不做后续操作。
  if (!valid && haveExpectedTypes) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  // // 如果代码运行到了这里，说明前面的校验全部通过。但是我们知道在定义 prop 时可以通过 validator 属性指定一个校验函数实现自定义校验，该函数的返回值作为校验的结果。
  // 开发者定义的 prop.validator 函数，接着只需要调用该函数并判断其返回值的真假即可，如果返回值为假说明自定义校验失败，则直接打印警告信息提示开发者该 prop 自定义校验失败即可。
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
  // assertType 函数的返回值是一个如下结构的对象即可：
  //   {
  //   expectedType: 'String',
  //   valid: true
  // }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

function assertType (value: any, type: Function, vm: ?Component): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  // 使用 simpleCheckRE 去匹配字符串 expectedType，如果匹配成功则说明期望的类型为以下五种类型之一：'String'、'Number'、'Boolean'、'Function' 以及 'Symbol'，
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    // 然后使用 t 与 expectedType 的小写作比较，如果全等则说明该 prop 的值与期望类型相同，此时 valid 将会为真。接着是一个 if 判断语句，
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    // 如果不满足以上，也不能立马判断校验失败，因为在 javascript 有个概念叫做 基本包装类型，
    // 比如可以这样定义一个字符串：const str = new String('基本包装类型')，但 str 的的确确是一个字符串
    // 所以需要进一步检查
    if (!valid && t === 'object') {
      // 使用 instanceof 操作符判断 value 是否是 type 的实例，如果是则依然认为该 prop 值是有效的。
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
    // 如果 expectedType 没有匹配前面的任何 if...elseif 语句，那么 else 语句块的代码将被执行，此时说明开发者在定义 prop 时所指定的期望类型为自定义类型，如：
    // 自定义类型构造函数
    // function Dog () {}
    // props: {
    //   prop1: {
    //     type: Dog
    //   }
    // }
  } else {
    try {
      valid = value instanceof type
    } catch (e) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm);
      valid = false;
    }
  }
  return {
    valid,
    expectedType
  }
}

const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
function isExplicable (value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
