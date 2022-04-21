"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
const vm = new index_1.default({
    props: ["bar"],
    data: {
        a: true
    },
    foo: "foo",
    methods: {
        foo() {
            this.a = false;
        }
    },
    computed: {
        BAR() {
            return this.bar.toUpperCase();
        }
    }
});
vm.$instanceProperty;
vm.$instanceMethod();
index_1.default.staticProperty;
index_1.default.staticMethod();
