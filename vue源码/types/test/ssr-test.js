"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../index"));
const VueSSRClientPlugin = require("../../packages/vue-server-renderer/client-plugin");
const VueSSRServerPlugin = require("../../packages/vue-server-renderer/server-plugin");
const webpack = require("webpack");
const fs_1 = require("fs");
const vue_server_renderer_1 = require("../../packages/vue-server-renderer");
function createApp(context) {
    return new index_1.default({
        data: {
            url: context.url
        },
        template: `<div>The visited URL is: {{ url }}</div>`
    });
}
// Renderer test
const app = createApp({ url: 'http://localhost:8000/' });
const renderer = (0, vue_server_renderer_1.createRenderer)({
    template: (0, fs_1.readFileSync)('./index.template.html', 'utf-8')
});
const context = {
    title: 'Hello',
    meta: `
    <meta name="description" content="Vue.js SSR Example">
  `
};
renderer.renderToString(app, (err, html) => {
    if (err)
        throw err;
    const res = html;
});
renderer.renderToString(app, context, (err, html) => {
    if (err)
        throw err;
    const res = html;
});
renderer.renderToString(app)
    .then(html => {
    const res = html;
})
    .catch(err => {
    throw err;
});
renderer.renderToString(app, context)
    .then(html => {
    const res = html;
})
    .catch(err => {
    throw err;
});
renderer.renderToStream(app, context).on('data', chunk => {
    const html = chunk.toString();
});
const bundleRenderer = (0, vue_server_renderer_1.createBundleRenderer)('/path/to/vue-ssr-server-bundle.json', {
    inject: false,
    runInNewContext: 'once',
    basedir: '/path/to/base',
    shouldPreload: (file, type) => {
        if (type === 'script' || type === 'style') {
            return true;
        }
        if (type === 'font') {
            return /\.woff2$/.test(file);
        }
        if (type === 'image') {
            return file === 'hero.jpg';
        }
        return false;
    },
    cache: {
        get: key => {
            return cacheClient[key];
        },
        set: (key, val) => {
            cacheClient[key] = val;
        },
        has: key => {
            return !!cacheClient[key];
        }
    },
    directives: {
        example(vnode, directiveMeta) {
            // transform vnode based on directive binding metadata
        }
    }
});
bundleRenderer.renderToString(context, (err, html) => {
    if (err)
        throw err;
    const res = html;
});
bundleRenderer.renderToString().then(html => {
    const res = html;
});
bundleRenderer.renderToString(context).then(html => {
    const res = html;
});
bundleRenderer.renderToStream(context).on('data', chunk => {
    const html = chunk.toString();
});
// webpack plugins
webpack({
    plugins: [
        new VueSSRClientPlugin({
            filename: 'client-manifest.json'
        }),
        new VueSSRServerPlugin({
            filename: 'server-bundle.json'
        })
    ]
});
