/* @flow */
// ssr ====>Server-Side Rendering
// 将所有编译器部分导出
export { parseComponent } from 'sfc/parser'
export { compile, compileToFunctions } from './compiler/index'
export { ssrCompile, ssrCompileToFunctions } from './server/compiler'
export { generateCodeFrame } from 'compiler/codeframe'
