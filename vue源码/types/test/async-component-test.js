"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
const a = () => ({
    component: new Promise((res, rej) => {
        res({ template: "" });
    })
});
const b = () => ({
    // @ts-expect-error component has to be a Promise that resolves to a component
    component: () => new Promise((res, rej) => {
        res({ template: "" });
    })
});
const c = () => new Promise((res, rej) => {
    res({
        template: ""
    });
});
const d = () => new Promise((res, rej) => {
    res({
        default: {
            template: ""
        }
    });
});
const e = () => ({
    component: new Promise((res, rej) => {
        res({
            default: {
                template: ""
            }
        });
    })
});
// Test that Vue.component accepts any AsyncComponent
index_1.default.component("async-compponent1", a);
