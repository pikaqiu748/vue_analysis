"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
class Test extends index_1.default {
    constructor() {
        super(...arguments);
        this.a = 0;
    }
    testProperties() {
        this.$data;
        this.$el;
        this.$options;
        this.$parent;
        this.$root;
        this.$children;
        this.$refs;
        this.$slots;
        this.$isServer;
        this.$ssrContext;
        this.$vnode;
    }
    testReification() {
        this.$refs.vue.$data;
        this.$refs.element.value;
        this.$refs.vues[0].$data;
        this.$refs.elements[0].value;
    }
    testMethods() {
        this.$mount("#app", false);
        this.$forceUpdate();
        this.$destroy();
        this.$set({}, "key", "value");
        this.$delete({}, "key");
        this.$watch("a", (val, oldVal) => { }, {
            immediate: true,
            deep: false
        })();
        this.$watch(() => this.a, (val) => { });
        this.$on("", () => { });
        this.$once("", () => { });
        this.$off("", () => { });
        this.$emit("", 1, 2, 3);
        this.$nextTick(function () {
            this.$nextTick;
        });
        this.$nextTick().then(() => { });
        this.$createElement("div", {}, "message");
    }
    static testConfig() {
        const { config } = this;
        config.silent;
        config.optionMergeStrategies;
        config.devtools;
        config.errorHandler = (err, vm) => {
            if (vm instanceof Test) {
                vm.testProperties();
                vm.testMethods();
            }
        };
        config.warnHandler = (msg, vm) => {
            if (vm instanceof Test) {
                vm.testProperties();
                vm.testMethods();
            }
        };
        config.keyCodes = { esc: 27 };
        config.ignoredElements = ['foo', /^ion-/];
        config.async = false;
    }
    static testMethods() {
        this.extend({
            data() {
                return {
                    msg: ""
                };
            }
        });
        this.nextTick(() => { });
        this.nextTick(function () {
            console.log(this.text === 'test');
        }, { text: 'test' });
        this.nextTick().then(() => { });
        this.set({}, "", "");
        this.set({}, 1, "");
        this.set([true, false, true], 1, true);
        this.delete({}, "");
        this.delete({}, 1);
        this.delete([true, false], 0);
        this.directive("", { bind() { } });
        this.filter("", (value) => value);
        this.component("", { data: () => ({}) });
        this.component("", { functional: true, render(h) { return h("div", "hello!"); } });
        this.use;
        this.mixin(Test);
        this.compile("<div>{{ message }}</div>");
        this
            .use(() => {
        })
            .use(() => {
        })
            .mixin({})
            .mixin({});
    }
}
const HelloWorldComponent = index_1.default.extend({
    props: ["name"],
    data() {
        return {
            message: "Hello " + this.name,
        };
    },
    computed: {
        shouted() {
            return this.message.toUpperCase();
        }
    },
    methods: {
        getMoreExcited() {
            this.message += "!";
        }
    },
    watch: {
        message(a) {
            console.log(`Message ${this.message} was changed!`);
        }
    }
});
const FunctionalHelloWorldComponent = index_1.default.extend({
    functional: true,
    props: ["name"],
    render(createElement, ctxt) {
        return createElement("div", "Hello " + ctxt.props.name);
    }
});
const FunctionalScopedSlotsComponent = index_1.default.extend({
    functional: true,
    render(h, ctx) {
        return ctx.scopedSlots.default && ctx.scopedSlots.default({}) || h('div', 'functional scoped slots');
    }
});
const Parent = index_1.default.extend({
    data() {
        return { greeting: 'Hello' };
    }
});
const Child = Parent.extend({
    methods: {
        foo() {
            console.log(this.greeting.toLowerCase());
        }
    }
});
const GrandChild = Child.extend({
    computed: {
        lower() {
            return this.greeting.toLowerCase();
        }
    }
});
new GrandChild().lower.toUpperCase();
for (let _ in (new Test()).$options) {
}
index_1.default.extend(options);
index_1.default.component('test-comp', options);
new index_1.default(options);
// cyclic example
index_1.default.extend({
    props: {
        bar: {
            type: String
        }
    },
    methods: {
        foo() { }
    },
    mounted() {
        this.foo();
    },
    // manual annotation
    render(h) {
        const a = this.bar;
        return h('canvas', {}, [a]);
    }
});
let Decorated = class Decorated extends index_1.default {
    constructor() {
        super(...arguments);
        this.a = 123;
    }
};
Decorated = __decorate([
    decorate
], Decorated);
const obj = index_1.default.observable({ a: 1 });
obj.a++;
// VNodeData style tests.
const ComponentWithStyleInVNodeData = index_1.default.extend({
    render(h) {
        const elementWithStyleAsString = h('div', {
            style: 'background-color: red;'
        });
        const elementWithStyleAsObject = h('div', {
            style: { backgroundColor: 'green' }
        });
        const elementWithStyleAsArrayOfObjects = h('div', {
            style: [
                { backgroundColor: 'blue' }
            ]
        });
        return h('div', undefined, [
            elementWithStyleAsString,
            elementWithStyleAsObject,
            elementWithStyleAsArrayOfObjects
        ]);
    }
});
