"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
const option = {
    data() {
        return {
            a: 123
        };
    }
};
// contravariant generic should use never
const anotherOption = option;
const componentType = option;
index_1.default.component('sub-component', {
    components: {
        a: index_1.default.component(""),
        b: {}
    }
});
index_1.default.component('prop-component', {
    props: {
        size: Number,
        name: {
            type: String,
            default: '0',
            required: true,
        }
    },
    data() {
        return {
            fixedSize: this.size.toFixed(),
            capName: this.name.toUpperCase()
        };
    }
});
index_1.default.component('string-prop', {
    props: ['size', 'name'],
    data() {
        return {
            fixedSize: this.size.whatever,
            capName: this.name.isany
        };
    }
});
class User {
    constructor() {
        this.u = 1;
    }
}
class Cat {
    constructor() {
        this.u = 1;
    }
}
index_1.default.component('union-prop', {
    props: {
        cat: Object,
        complexUnion: { type: [User, Number] },
        kittyUser: Object,
        callback: Function,
        union: [User, Number]
    },
    data() {
        this.cat;
        this.complexUnion;
        this.kittyUser;
        this.callback(true);
        this.union;
        return {
            fixedSize: this.union,
        };
    }
});
index_1.default.component('union-prop-with-no-casting', {
    props: {
        mixed: [RegExp, Array],
        object: [Cat, User],
        primitive: [String, Number],
        regex: RegExp
    },
    data() {
        this.mixed;
        this.object;
        this.primitive;
        this.regex.compile;
    }
});
index_1.default.component('prop-with-primitive-default', {
    props: {
        id: {
            type: String,
            default: () => String(Math.round(Math.random() * 10000000))
        }
    },
    created() {
        this.id;
    }
});
index_1.default.component('component', {
    data() {
        this.$mount;
        this.size;
        return {
            a: 1
        };
    },
    props: {
        size: Number,
        name: {
            type: String,
            default: '0',
            required: true,
        }
    },
    propsData: {
        msg: "Hello"
    },
    computed: {
        aDouble() {
            return this.a * 2;
        },
        aPlus: {
            get() {
                return this.a + 1;
            },
            set(v) {
                this.a = v - 1;
            },
            cache: false
        }
    },
    methods: {
        plus() {
            this.a++;
            this.aDouble.toFixed();
            this.aPlus = 1;
            this.size.toFixed();
        }
    },
    watch: {
        'a': function (val, oldVal) {
            console.log(`new: ${val}, old: ${oldVal}`);
        },
        'b': 'someMethod',
        'c': {
            handler(val, oldVal) {
                this.a = val;
            },
            deep: true
        },
        d: {
            handler: 'someMethod',
            immediate: true
        }
    },
    el: "#app",
    template: "<div>{{ message }}</div>",
    render(createElement) {
        return createElement("div", {
            attrs: {
                id: "foo"
            },
            props: {
                myProp: "bar"
            },
            directives: [{
                    name: 'a',
                    value: 'foo'
                }],
            domProps: {
                innerHTML: "baz"
            },
            on: {
                click: new Function
            },
            nativeOn: {
                click: new Function
            },
            class: {
                foo: true,
                bar: false
            },
            style: {
                color: 'red',
                fontSize: '14px'
            },
            key: 'myKey',
            ref: 'myRef',
            refInFor: true
        }, [
            createElement(),
            createElement("div", "message"),
            createElement(index_1.default.component("component")),
            createElement({}),
            createElement({
                functional: true,
                render(c) {
                    return createElement();
                }
            }),
            createElement(() => index_1.default.component("component")),
            createElement(() => ({})),
            createElement((resolve, reject) => {
                resolve({});
                reject();
            }),
            "message",
            [createElement("div", "message")]
        ]);
    },
    renderError(createElement, err) {
        return createElement('pre', { style: { color: 'red' } }, err.stack);
    },
    staticRenderFns: [],
    beforeCreate() {
        this.a = 1;
    },
    created() { },
    beforeDestroy() { },
    destroyed() { },
    beforeMount() { },
    mounted() { },
    beforeUpdate() { },
    updated() { },
    activated() { },
    deactivated() { },
    errorCaptured(err, vm, info) {
        err.message;
        vm.$emit('error');
        info.toUpperCase();
        return true;
    },
    serverPrefetch() {
        return Promise.resolve();
    },
    directives: {
        a: {
            bind() { },
            inserted() { },
            update() { },
            componentUpdated() { },
            unbind() { }
        },
        b(el, binding, vnode, oldVnode) {
            el.textContent;
            binding.name;
            binding.value;
            binding.oldValue;
            binding.expression;
            binding.arg;
            binding.modifiers["modifier"];
        }
    },
    components: {
        a: index_1.default.component(""),
        b: {}
    },
    transitions: {},
    filters: {
        double(value) {
            return value * 2;
        }
    },
    parent: new index_1.default,
    mixins: [index_1.default.component(""), {}],
    name: "Component",
    extends: {},
    delimiters: ["${", "}"]
});
index_1.default.component('custom-prop-type-function', {
    props: {
        callback: Function,
    },
    methods: {
        confirm() {
            this.callback(true);
        }
    }
});
index_1.default.component('provide-inject', {
    provide: {
        foo: 1
    },
    inject: {
        injectFoo: 'foo',
        injectBar: Symbol(),
        injectBaz: { from: 'baz' },
        injectQux: { default: 1 },
        injectQuux: { from: 'quuz', default: () => ({ value: 1 }) }
    }
});
index_1.default.component('provide-function', {
    provide: () => ({
        foo: 1
    })
});
index_1.default.component('component-with-slot', {
    render(h) {
        return h('div', this.$slots.default);
    }
});
index_1.default.component('component-with-scoped-slot', {
    render(h) {
        return h('div', [
            h('child', [
                // default scoped slot as children
                (props) => [h('span', [props.msg])]
            ]),
            h('child', {
                scopedSlots: {
                    // named scoped slot as vnode data
                    item: (props) => [h('span', [props.msg])]
                }
            }),
            h('child', [
                // return single VNode (will be normalized to an array)
                (props) => h('span', [props.msg])
            ]),
            h('child', {
                // Passing down all slots from parent
                scopedSlots: this.$scopedSlots
            }),
            h('child', {
                // Passing down single slot from parent
                scopedSlots: {
                    default: this.$scopedSlots.default
                }
            })
        ]);
    },
    components: {
        child: {
            render(h) {
                const defaultSlot = this.$scopedSlots['default']({ msg: 'hi' });
                defaultSlot && defaultSlot.forEach(vnode => {
                    vnode.tag;
                });
                return h('div', [
                    defaultSlot,
                    this.$scopedSlots['item']({ msg: 'hello' })
                ]);
            }
        }
    }
});
index_1.default.component('narrow-array-of-vnode-type', {
    render(h) {
        const slot = this.$scopedSlots.default({});
        if (typeof slot === 'string') {
            // <template slot-scope="data">bare string</template>
            return h('span', slot);
        }
        else if (Array.isArray(slot)) {
            // template with multiple children
            const first = slot[0];
            if (!Array.isArray(first) && typeof first !== 'string' && first) {
                return first;
            }
            else {
                return h();
            }
        }
        else if (slot) {
            // <div slot-scope="data">bare VNode</div>
            return slot;
        }
        else {
            // empty template, slot === undefined
            return h();
        }
    }
});
index_1.default.component('functional-component', {
    props: ['prop'],
    functional: true,
    inject: ['foo'],
    render(createElement, context) {
        context.props;
        context.children;
        context.slots();
        context.data;
        context.parent;
        context.scopedSlots;
        context.listeners.click;
        return createElement("div", {}, context.children);
    }
});
index_1.default.component('functional-component-object-inject', {
    functional: true,
    inject: {
        foo: 'foo',
        bar: Symbol(),
        baz: { from: 'baz' },
        qux: { default: 1 },
        quux: { from: 'quuz', default: () => ({ value: 1 }) }
    },
    render(h) {
        return h('div');
    }
});
index_1.default.component('functional-component-check-optional', {
    functional: true
});
index_1.default.component('functional-component-multi-root', {
    functional: true,
    render(h) {
        return [
            h("tr", [h("td", "foo"), h("td", "bar")]),
            h("tr", [h("td", "lorem"), h("td", "ipsum")])
        ];
    }
});
index_1.default.component("async-component", ((resolve, reject) => {
    setTimeout(() => {
        resolve(index_1.default.component("component"));
    }, 0);
    return new Promise((resolve) => {
        resolve({
            functional: true,
            render(h) { return h('div'); }
        });
    });
}));
index_1.default.component('functional-component-v-model', {
    props: ['foo'],
    functional: true,
    model: {
        prop: 'foo',
        event: 'change'
    },
    render(createElement, context) {
        return createElement("input", {
            on: {
                input: new Function()
            },
            domProps: {
                value: context.props.foo
            }
        });
    }
});
index_1.default.component('async-es-module-component', () => Promise.resolve().then(() => __importStar(require('./es-module'))));
index_1.default.component('directive-expression-optional-string', {
    render(createElement) {
        return createElement("div", {
            directives: [
                {
                    name: 'has-expression',
                    value: 2,
                    expression: '1 + 1',
                }, {
                    name: 'no-expression',
                    value: 'foo',
                },
            ],
        });
    }
});
