import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 这个文件才是 Vue 构造函数真正的“出生地”
// 其中使用了安全模式来提醒你要使用 new 操作符来调用 Vue，接着将 Vue 构造函数作为参数，分别传递给了导入进来的这五个方法，最后导出 Vue。
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// 在vue原型上添加_init()方法
initMixin(Vue)

// 在原型上定义$data 、 $props、$set、$del、$watch
stateMixin(Vue)

eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
