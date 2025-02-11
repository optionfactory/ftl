import { Fragments } from "./fragments.mjs";
import { Expressions } from "./expressions.mjs";


class NodeOperations {
    #forRemoval;
    constructor() {
        this.#forRemoval = [];
    }
    remove(node) {
        node.replaceChildren?.();
        Object.keys(node.dataset || {})
            .filter(k => k.startsWith('tpl'))
            .forEach(k => delete node.dataset[k]);
        this.#forRemoval.push(node);
    }
    popData(node, key) {
        const v = node.dataset[key];
        delete node.dataset[key];
        return v;
    }
    replace(node, nodes) {
        const els = Array.from(nodes);
        for (let i = 0; i !== els.length; ++i) {
            node.parentNode.insertBefore(els[i], node);
        }
        this.remove(node);
    }
    replaceAndEvaluate(node, nodes) {
        const els = Array.from(nodes);
        let predecessor = node.nextSibling;
        for (let i = 0; i !== els.length; ++i) {
            const el = els[i];
            const lastRealElement = (el instanceof DocumentFragment) ? el.lastChild : el;
            node.parentNode.insertBefore(el, predecessor);
            predecessor = lastRealElement?.nextSibling;
        }
        this.remove(node);
    }
    cleanup() {
        while (this.#forRemoval.length) {
            this.#forRemoval.pop().remove();
        }
    }
}

class CommandsHandler {
    static ORDERED_COMMANDS = [
        'tplIf', 'tplWith', 'tplEach', 'tplWhen', 'tplValue', 'tplClassAppend', 'tplAttrAppend', 'tplText', 'tplHtml', 'tplRemove'
    ];
    static tplIf(template, node, expression, ops) {
        const accept = template.evaluate(expression);
        if (!accept) {
            ops.remove(node);
        }
    }
    static tplWith(template, node, expression, ops) {
        const evaluated = template.evaluate(expression);
        const varName = ops.popData(node, 'tplVar');
        const fragment = new DocumentFragment();
        //node needs to be cloned as it's used as a placeholder in ops.replace
        fragment.appendChild(node.cloneNode(true));
        const newNode = template.withFragment(fragment).render(varName ? { [varName]: evaluated } : evaluated);
        ops.replace(node, [newNode]);
    }
    static tplEach(template, node, expression, ops) {
        const varName = ops.popData(node, 'tplVar');
        const evaluated = template.evaluate(expression);
        const fragment = new DocumentFragment();
        //node needs to be cloned as it's used as a placeholder in ops.replace
        fragment.appendChild(node.cloneNode(true));
        const nodes = evaluated.map(v => {
            return template.withFragment(fragment).render(varName ? { [varName]: v } : v);
        });
        ops.replace(node, nodes);
    }
    static tplWhen(template, node, expression, ops) {
        const accept = template.evaluate(expression);
        if (!accept) {
            ops.remove(node);
        }
    }
    static tplRemove(template, node, value, ops) {
        switch (value.toLowerCase()) {
            case 'tag':
                ops.replaceAndEvaluate(node, node.childNodes);
                break;
            case 'body':
                node.replaceChildren();
                break;
            case 'all':
                ops.remove(node);
                break;
        }
    }
    static tplText(template, node, expression, ops) {
        const text = template.evaluate(expression);
        const newNode = node.cloneNode();
        newNode.replaceChildren(text === null || text === undefined ? "" : text);
        ops.replace(node, [newNode]);
    }
    static tplValue(template, node, expression, ops) {
        node.value = template.evaluate(expression);
    }
    static tplHtml(template, node, expression, ops) {
        const html = template.evaluate(expression);
        const newNode = node.cloneNode();
        newNode.innerHTML = html === null || html === undefined ? "" : html;
        ops.replace(node, [newNode]);
    }
    static tplClassAppend(template, node, expression, ops) {
        const classes = template.evaluate(expression);
        const classesAsArray = Array.isArray(classes) ? classes : [classes];
        node.classList.add(...classesAsArray);
    }
    static tplAttrAppend(template, node, expression, ops) {
        const attributesAndValues = template.evaluate(expression);
        if (attributesAndValues.length === 0) {
            return;
        }
        const tuples = Array.isArray(attributesAndValues[0]) ? attributesAndValues : [attributesAndValues];
        tuples.forEach(([k, v]) => {
            node.setAttribute(k, v);
        });
    }
    static textNode(template, node, expression, ops) {
        const nodes = template.evaluate(expression, Expressions.MODE_TEMPLATED)
            .map(v => {
                switch (v.type) {
                    case 't': return document.createTextNode(v.value === null || v.value === undefined ? "" : v.value);
                    case 'h': return Fragments.fromHtml(v.value === null || v.value === undefined ? "" : v.value);
                    case 'n': return v.value === null || v.value === undefined ? new DocumentFragment() : v.value;
                }
            });
        ops.replace(node, nodes);
    }
}

class Template {
    /**
     * @param {string} html
     * @param {{ [k: string] : any }?} modules
     * @param {...*} data
     * @returns the template
     */
    static fromHtml(html, modules, ...data) {
        return new Template(Fragments.fromHtml(html), modules, data);
    }

    /**
     * 
     * @param {string} selector for an HTMLTemplateElement
     * @param {{ [k: string] : any }?} modules
     * @param {...*} data 
     * @returns the template
     */
    static fromSelector(selector, modules, ...data) {
        const templateEl = document.querySelector(selector);
        if (!(templateEl instanceof HTMLTemplateElement)) {
            throw new Error("template selector does not match any template tag");
        }
        const fragment = templateEl.content;
        return new Template(fragment, modules, data);
    }

    /**
     * 
     * @param {HTMLTemplateElement} templateEl 
     * @param {{ [k: string] : any }?} modules
     * @param {...*} data 
     * @returns the template
     */
    static fromTemplate(templateEl, modules, ...data) {
        const fragment = templateEl.content;
        return new Template(fragment, modules, data);
    }

    /**
     * 
     * @param {DocumentFragment} fragment 
     * @param { { [k: string] : any }? } modules
     * @param {...*} data 
     * @returns the template
     */
    static fromFragment(fragment, modules, ...data) {
        return new Template(fragment, modules, data);
    }
    #fragment;
    #modules;
    #dataStack;
    /**
     * @param {DocumentFragment} fragment
     * @param {{ [x: string]: any; }?} modules
     * @param {any[]} dataStack
     */
    constructor(fragment, modules, dataStack) {
        this.#fragment = fragment;
        this.#modules = modules;
        this.#dataStack = dataStack;
    }
    withFragment(fragment) {
        return new Template(fragment, this.#modules, this.#dataStack);
    }
    withData(...data) {
        return data.length === 0 ? this : new Template(this.#fragment, this.#modules, [...this.#dataStack, ...data]);
    }
    evaluate(expression, mode) {
        return Expressions.interpret(this.#modules, this.#dataStack, expression, mode);
    }
    render(...data) {
        const tpl = this.withData(...data);
        try {
            const ops = new NodeOperations();
            const fragment = document.importNode(tpl.#fragment, true);
            const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, Template.#NODE_FILTER);
            let node;
            while ((node = iterator.nextNode()) !== null) {
                ops.cleanup();
                if (node.nodeType === Node.TEXT_NODE) {
                    try {
                        CommandsHandler.textNode(tpl, node, node.nodeValue, ops);
                    } catch (ex) {
                        throw new RenderError("Error evaluating text node", node, ex);
                    }
                    continue;
                }
                const commands = CommandsHandler.ORDERED_COMMANDS;
                for (let i = 0; i !== commands.length; ++i) {
                    const command = commands[i];
                    // @ts-ignore
                    if (!(command in node.dataset)) {
                        continue;
                    }
                    const value = ops.popData(node, command);
                    try {
                        CommandsHandler[command](tpl, node, value, ops);
                    } catch (ex) {
                        throw new RenderError(`Error evaluating command ${command}`, node, ex);
                    }
                }
                // @ts-ignore
                Object.keys(node.dataset || {})
                    .filter(k => k.startsWith('tpl'))
                    .map(k => [k, k.substring('tpl'.length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                    .forEach(([dataSetKey, attributeName]) => {
                        const expression = ops.popData(node, dataSetKey);
                        const evaluated = tpl.evaluate(expression);
                        if (typeof evaluated !== 'boolean') {
                            if (evaluated !== null && evaluated !== undefined) {
                                node.setAttribute(attributeName, evaluated);
                            }
                            return;
                        }
                        if (evaluated) {
                            node.setAttribute(attributeName, attributeName);
                        } else {
                            node.removeAttribute(attributeName);
                        }
                    });
            }
            ops.cleanup();
            return fragment;
        } catch (ex) {
            throw new RenderError("Error rendering template", tpl.#fragment, ex)
        }
    }
    renderTo(el, ...data) {
        const fragment = this.render(...data);
        el.replaceChildren(fragment);
    }
    appendTo(el, ...data) {
        const fragment = this.render(...data);
        el.appendChild(fragment);
    }
    renderToSelector(selector, ...data) {
        const el = document.querySelector(selector);
        this.renderTo(el, ...data);
    }
    appendToSelector(selector, ...data) {
        const el = document.querySelector(selector);
        this.appendTo(el, ...data);
    }
    static #NODE_FILTER(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.includes("{{") && node.nodeValue.includes("}}") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
        for (const attr of node.attributes) {
            if (attr.name.startsWith("data-tpl-")) {
                return NodeFilter.FILTER_ACCEPT;
            }
        }
        return NodeFilter.FILTER_SKIP;
    }
}

class RenderError extends Error {
    constructor(message, nodeOrFragment, cause) {
        super(`${message} in \`${RenderError.stringify(nodeOrFragment)}\``, { cause });
        this.name = "RenderError";
        this.node = nodeOrFragment.cloneNode(true);
    }
    static stringify(nodeOrFragment) {
        const t = document.createElement("template");
        t.content.appendChild(RenderError.#cleanup(nodeOrFragment.cloneNode(true)));
        return t.innerHTML;
    }
    static #cleanup(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            node.nodeValue = node.nodeValue.trim();
        }
        for (var n = 0; n < node.childNodes.length; n++) {
            var child = node.childNodes[n];
            if (child.nodeType === Node.TEXT_NODE) {
                child.nodeValue = child.nodeValue.trim();
                if (child.nodeValue.length === 0) {
                    node.removeChild(child);
                    n--;
                }
            }
            else if (child.nodeType === Node.ELEMENT_NODE) {
                RenderError.#cleanup(child);
            }
        }
        return node;
    }
}



export { Template };
