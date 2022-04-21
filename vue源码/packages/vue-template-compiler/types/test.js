"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vue_1 = __importDefault(require("vue"));
const _1 = require("./");
// check compile options
const compiled = (0, _1.compile)("<div>hi</div>", {
    outputSourceRange: true,
    preserveWhitespace: false,
    whitespace: 'condense',
    modules: [
        {
            preTransformNode: el => el,
            transformNode: el => el,
            postTransformNode: el => {
                el.tag = "p";
            },
            genData: el => el.tag,
            transformCode: (el, code) => code,
            staticKeys: ["test"]
        }
    ],
    directives: {
        test: (node, directiveMeta) => {
            node.tag;
            directiveMeta.value;
        }
    }
});
// can be passed to function constructor
new Function(compiled.render);
compiled.staticRenderFns.map(fn => new Function(fn));
// with outputSourceRange: true
// errors should be objects with range
compiled.errors.forEach(e => {
    console.log(e.msg);
});
// without option or without outputSourceRange: true, should be strings
const { errors } = (0, _1.compile)(`foo`);
errors.forEach(e => {
    console.log(e.length);
});
const { errors: errors2 } = (0, _1.compile)(`foo`, {});
errors2.forEach(e => {
    console.log(e.length);
});
const { errors: errors3 } = (0, _1.compile)(`foo`, {
    outputSourceRange: false
});
errors3.forEach(e => {
    console.log(e.length);
});
const compiledFns = (0, _1.compileToFunctions)("<div>hi</div>");
// can be passed to component render / staticRenderFns options
const vm = new vue_1.default({
    data() {
        return {
            test: "Test"
        };
    },
    render: compiledFns.render,
    staticRenderFns: compiledFns.staticRenderFns
});
// can be called with component instance
const vnode = compiledFns.render.call(vm);
// check SFC parser
const desc = (0, _1.parseComponent)("<template></template>", {
    pad: "space",
    deindent: false
});
const templateContent = desc.template.content;
const scriptContent = desc.script.content;
const styleContent = desc.styles.map(s => s.content).join("\n");
const codeframe = (0, _1.generateCodeFrame)(`foobar`, 0, 4);
