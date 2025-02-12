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
    static tplIf(node, expression, ops, modules, dataStack) {
        const accept = Expressions.interpret(modules, dataStack, expression);
        if (!accept) {
            ops.remove(node);
        }
    }
    static tplWith(node, expression, ops, modules, dataStack) {
        const evaluated = Expressions.interpret(modules, dataStack, expression);
        const varName = ops.popData(node, 'tplVar');
        const newNode = new Template(node, modules, dataStack).withOverlay(varName ? { [varName]: evaluated } : evaluated).render();
        ops.replace(node, [newNode]);
    }
    static tplEach(node, expression, ops, modules, dataStack) {
        const varName = ops.popData(node, 'tplVar');
        const template = new Template(node, modules, dataStack);
        const evaluated = Expressions.interpret(modules, dataStack, expression);
        const nodes = evaluated.map(v => template.withOverlay(varName ? { [varName]: v } : v).render());
        ops.replace(node, nodes);
    }
    static tplWhen(node, expression, ops, modules, dataStack) {
        const accept = Expressions.interpret(modules, dataStack, expression);
        if (!accept) {
            ops.remove(node);
        }
    }
    static tplRemove(node, value, ops, modules, dataStack) {
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
    static tplText(node, expression, ops, modules, dataStack) {
        const text = Expressions.interpret(modules, dataStack, expression);
        const newNode = node.cloneNode();
        newNode.replaceChildren(text === null || text === undefined ? "" : text);
        ops.replace(node, [newNode]);
    }
    static tplValue(node, expression, ops, modules, dataStack) {
        node.value = Expressions.interpret(modules, dataStack, expression);
    }
    static tplHtml(node, expression, ops, modules, dataStack) {
        const html = Expressions.interpret(modules, dataStack, expression);
        const newNode = node.cloneNode();
        newNode.innerHTML = html === null || html === undefined ? "" : html;
        ops.replace(node, [newNode]);
    }
    static tplClassAppend(node, expression, ops, modules, dataStack) {
        const classes = Expressions.interpret(modules, dataStack, expression);
        const classesAsArray = Array.isArray(classes) ? classes : [classes];
        node.classList.add(...classesAsArray);
    }
    static tplAttrAppend(node, expression, ops, modules, dataStack) {
        const attributesAndValues = Expressions.interpret(modules, dataStack, expression);
        if (attributesAndValues.length === 0) {
            return;
        }
        const tuples = Array.isArray(attributesAndValues[0]) ? attributesAndValues : [attributesAndValues];
        tuples.forEach(([k, v]) => {
            node.setAttribute(k, v);
        });
    }
    static textNode(node, expression, ops, modules, dataStack) {
        const nodes = Expressions.interpret(modules, dataStack, expression, Expressions.MODE_TEMPLATED)
            .map(v => {
                if (v.value === null || v.value === undefined) {
                    return null
                }
                switch (v.type) {
                    case 't': return document.createTextNode(v.value);
                    case 'h': return Fragments.fromHtml(v.value);
                    case 'n': return v.value;
                }
            }).filter(v => v);
        ops.replace(node, nodes);
    }
}

class Template {
    /**
     * Creates a template from a string.
     * @param {string} html
     * @param {{ [k: string] : any }?} modules
     * @param {...*} data
     * @returns the template
     */
    static fromHtml(html, modules, ...data) {
        return new Template(Fragments.fromHtml(html), modules, data);
    }

    /**
     * Creates a template from the content of the first template element matching the selector.
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
     * Creates a template from the content of an HTMLTemplateElement.
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
     * Creates a template from a DocumentFragment.
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
     * Creates a template.
     * @param {DocumentFragment} fragment
     * @param {{ [x: string]: any; }?} modules
     * @param {any[]} dataStack
     */
    constructor(fragment, modules, dataStack) {
        this.#fragment = fragment;
        this.#modules = modules;
        this.#dataStack = dataStack;
    }
    /**
     * Creates a new Template replacing the fragment.
     * @param {DocumentFragment} fragment
     */
    withFragment(fragment) {
        return new Template(fragment, this.#modules, this.#dataStack);
    }
    /**
     * Creates a new Template with a new module added.
     * @param {string?} name
     * @param {{[k: string]: any}} value
     */
    withModule(name, value) {
        const module = name ? {[name]: value} : value;
        return new Template(this.#fragment, { ...this.#modules, module }, this.#dataStack);
    }
    /**
     * Creates a new Template replacing the modules.
     * @param {{ [x: string]: any; }?} modules
     */
    withModules(modules) {
        return new Template(this.#fragment, modules, this.#dataStack);
    }
    /**
     * Creates a new Template replacing the data stack.
     * @param {...*} data
     */
    withData(...data) {
        return new Template(this.#fragment, this.#modules, data);
    }
    /**
     * Creates a new Template with new a data overlay added to the stack.
     * @param {...*} data
     */
    withOverlay(...data) {
        return new Template(this.#fragment, this.#modules, data.length == 0 ? this.#dataStack : [...this.#dataStack, ...data]);
    }
    /**
     * Evaluates an expression using the configured modules and data.
     * @param {string} expression
     * @param {(Expressions.MODE_EXPRESSION | Expressions.MODE_TEMPLATED)?} [mode]
     */
    evaluate(expression, mode) {
        return Expressions.interpret(this.#modules, this.#dataStack, expression, mode);
    }
    /**
     * Renders the template.
     * @returns a DocumentFragment
     */
    render() {
        try {
            const ops = new NodeOperations();
            const imported = document.importNode(this.#fragment, true);
            const fragment = imported instanceof DocumentFragment ? imported : (() => {
                const d = new DocumentFragment();
                d.appendChild(imported);
                return d;
            })();
            const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, Template.#NODE_FILTER);
            let node;
            while ((node = iterator.nextNode()) !== null) {
                ops.cleanup();
                if (node.nodeType === Node.TEXT_NODE) {
                    try {
                        CommandsHandler.textNode(node, node.nodeValue, ops, this.#modules, this.#dataStack);
                    } catch (ex) {
                        throw new RenderError("Error evaluating text node", node, ex);
                    }
                    continue;
                }
                for (const command of CommandsHandler.ORDERED_COMMANDS) {
                    // @ts-ignore
                    if (!(command in node.dataset)) {
                        continue;
                    }
                    const value = ops.popData(node, command);
                    try {
                        CommandsHandler[command](node, value, ops, this.#modules, this.#dataStack);
                    } catch (ex) {
                        throw new RenderError(`Error evaluating command ${command}`, node, ex);
                    }
                }
                // @ts-ignore
                Object.keys(node.dataset || {})
                    .filter(k => k.startsWith('tpl'))
                    .map(k => [k, k.substring('tpl'.length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                    .forEach(([dataSetKey, attributeName]) => {
                        try {
                            const expression = ops.popData(node, dataSetKey);
                            const evaluated = Expressions.interpret(this.#modules, this.#dataStack, expression);
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
                        } catch (ex) {
                            throw new RenderError(`Error evaluating command ${dataSetKey}`, node, ex);
                        }
                    });
            }
            ops.cleanup();
            return fragment;
        } catch (ex) {
            throw new RenderError("Error rendering template", this.#fragment, ex)
        }
    }
    /**
     * Renders this template on the Element (replacing children).
     * @param {Element} el 
     */
    renderTo(el) {
        el.replaceChildren(this.render());
    }
    /**
     * Renders this template appending the resulting fragment to the Element.
     * @param {Element} el 
     */
    appendTo(el) {
        el.appendChild(this.render());
    }
    /**
     * Renders this template appending the resulting fragment to the first Element maching the selector, if exists.
     * @param {string} selector 
     */
    renderToSelector(selector) {
        const el = document.querySelector(selector);
        if (el) {
            this.renderTo(el);
        }
    }
    /**
     * Renders this template appending the resulting fragment to the Element maching the selector, if exists.
     * @param {string} selector 
     */
    appendToSelector(selector) {
        const el = document.querySelector(selector);
        if (el) {
            this.appendTo(el);
        }
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



export { Template, RenderError };
