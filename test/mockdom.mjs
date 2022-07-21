/* global globalThis */

import { JSDOM } from "jsdom";


const blacklisted = [
    'localStorage',
    'sessionStorage',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'queueMicrotask',
    'console'
];

function mockdom(html) {
    let jsdom = new JSDOM(html);
    for (let k in jsdom.window) {
        if (blacklisted.indexOf(k) !== -1) {
            continue;
        }
        globalThis[k] = jsdom.window[k];
    }
    globalThis.Node = jsdom.window.Node;
    globalThis.NodeList = jsdom.window.NodeList;
    globalThis.Element = jsdom.window.Element;
    globalThis.DocumentFragment = jsdom.window.DocumentFragment;
    globalThis.NodeFilter = jsdom.window.NodeFilter;
    globalThis.HTMLTemplateElement = jsdom.window.HTMLTemplateElement;
    return jsdom;
}


export { mockdom };