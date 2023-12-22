/* global globalThis */

import { JSDOM } from "jsdom";


function mockdom(html) {
    let jsdom = new JSDOM(html);
    globalThis.document = jsdom.window.document;
    globalThis.Node = jsdom.window.Node;
    globalThis.NodeList = jsdom.window.NodeList;
    globalThis.Element = jsdom.window.Element;
    globalThis.DocumentFragment = jsdom.window.DocumentFragment;
    globalThis.NodeFilter = jsdom.window.NodeFilter;
    globalThis.HTMLTemplateElement = jsdom.window.HTMLTemplateElement;
    return jsdom;
}


export { mockdom };