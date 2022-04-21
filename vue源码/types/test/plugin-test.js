"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
class Option {
    constructor() {
        this.prefix = "";
        this.suffix = "";
    }
}
const plugin = {
    install(Vue, option) {
        if (typeof option !== "undefined") {
            const { prefix, suffix } = option;
        }
    }
};
const installer = function (Vue, option) { };
index_1.default.use(plugin, new Option);
index_1.default.use(installer, new Option);
index_1.default.use(installer, new Option, new Option, new Option);
