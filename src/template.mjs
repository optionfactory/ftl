/* global NodeFilter, Node, DocumentFragment */
import { Fragments } from "./fragments.mjs";
import { ExpressionEvaluator } from "./expressions.mjs";

const createNodeFilter = (dataPrefix, textNodeExpressionStart, textNodeExpressionEnd) => {
    const attributePrefix = `data-${dataPrefix}-`;
    return (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.includes(textNodeExpressionStart) && node.nodeValue.includes(textNodeExpressionEnd)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
        return Array.from(node.attributes).some(attr => attr.name.startsWith(attributePrefix))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
    };
}

class NodeOperations {
    #prefix;
    #forRemoval;
    constructor(prefix) {
        this.#prefix = prefix;
        this.#forRemoval = [];
    }
    remove(node) {
        node.replaceChildren?.();
        Object.keys(node.dataset || {})
            .filter(k => k.startsWith(this.#prefix))
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

class TplCommandsHandler {
    static DATA_PREFIX = 'tpl';
    static ORDERED_COMMANDS = [
        'tplIf', 'tplWith', 'tplEach', 'tplValue', 'tplClassAppend', 'tplAttrAppend', 'tplText', 'tplHtml', 'tplRemove'
    ];
    tplIf(template, node, expression, ops) {
        const accept = template.evaluate(expression);
        if (!accept) {
            ops.remove(node);
        }
    }
    tplWith(template, node, expression, ops) {
        const evaluated = template.evaluate(expression);
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const fragment = new DocumentFragment();
        //node needs to be cloned as it's used as a placeholder in ops.replace
        fragment.appendChild(node.cloneNode(true));
        const newNode = template.withFragment(fragment).render(varName ? { [varName]: evaluated } : evaluated);
        ops.replace(node, [newNode]);
    }
    tplEach(template, node, expression, ops) {
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const evaluated = template.evaluate(expression);
        const fragment = new DocumentFragment();
        //node needs to be cloned as it's used as a placeholder in ops.replace
        fragment.appendChild(node.cloneNode(true));
        const nodes = evaluated.map(v => {
            return template.withFragment(fragment).render(varName ? { [varName]: v } : v);
        });
        ops.replace(node, nodes);
    }
    tplRemove(template, node, value, ops) {
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
    tplText(template, node, expression, ops) {
        const text = template.evaluate(expression);
        const newNode = node.cloneNode();
        newNode.replaceChildren(text === null || text === undefined ? "" : text);
        ops.replace(node, [newNode]);
    }
    tplValue(template, node, expression, ops) {
        node.value = template.evaluate(expression);
    }
    tplHtml(template, node, expression, ops) {
        const html = template.evaluate(expression);
        const newNode = node.cloneNode();
        newNode.innerHTML = html === null || html === undefined ? "" : html;
        ops.replace(node, [newNode]);
    }
    tplClassAppend(template, node, expression, ops) {
        const classes = template.evaluate(expression);
        const classesAsArray = Array.isArray(classes) ? classes : [classes];
        node.classList.add(...classesAsArray);
    }
    tplAttrAppend(template, node, expression, ops) {
        const attributesAndValues = template.evaluate(expression);
        if (attributesAndValues.length === 0) {
            return;
        }
        const tuples = Array.isArray(attributesAndValues[0]) ? attributesAndValues : [attributesAndValues];
        tuples.forEach(([k, v]) => {
            node.setAttribute(k, v);
        });
    }
    textNode(template, node, expression, ops) {
        const nodes = template.evaluateTemplated(expression)
            .map(v => {
                switch (v.type) {
                    case 't': return document.createTextNode(v.value === null || v.value === undefined ? "" : v.value);
                    case 'h': return Fragments.fromHtml(v.value === null || v.value === undefined ? "" : v.value);
                    case 'n': return v.value;
                }
            });
        ops.replace(node, nodes);
    }
}


class EvaluationContext {
    #functions;
    constructor(functions) {
        this.#functions = functions;
    }
    withModule(name, functions) {
        const fns = {
            ...this.#functions,
            [name]: functions,
        };
        return EvaluationContext.configure(fns);
    }
    withModules(functions) {
        const fns = {
            ...this.#functions,
            ...functions,
        };
        return EvaluationContext.configure(fns);
    }
    get functions() {
        return this.#functions;
    }
    static configure(functions) {
        return new EvaluationContext(functions);
    }
}

class Template {
    /**
     * 
     * @param {string} html 
     * @param {EvaluationContext} ec 
     * @param {...*} data 
     * @returns the template
     */
    static fromHtml(html, ec, ...data) {
        return new Template(Fragments.fromHtml(html), ec, ...data);
    }

    /**
     * 
     * @param {string} selector for an HTMLTemplateElement
     * @param {EvaluationContext} ec 
     * @param {...*} data 
     * @returns the template
     */
    static fromSelector(selector, ec, ...data) {
        const templateEl = document.querySelector(selector);
        if(!(templateEl instanceof HTMLTemplateElement)){
            throw new Error("template selector does not match any template tag");
        }
        const fragment = templateEl.content;
        return new Template(fragment, ec, ...data);
    }

    /**
     * 
     * @param {HTMLTemplateElement} templateEl 
     * @param {EvaluationContext} ec 
     * @param {...*} data 
     * @returns the template
     */
    static fromTemplate(templateEl, ec, ...data) {
        const fragment = templateEl.content;
        return new Template(fragment, ec, ...data);
    }

    /**
     * 
     * @param {DocumentFragment} fragment 
     * @param {EvaluationContext} ec 
     * @param {...*} data 
     * @returns the template
     */
    static fromFragment(fragment, ec, ...data) {
        return new Template(fragment, ec, ...data);
    }
    #fragment;
    #ec;
    #expressionEvaluator;
    #commandsHandler;
    #data;
    constructor(fragment, ec, ...data) {
        this.#fragment = fragment;
        this.#ec = ec;
        this.#expressionEvaluator = new ExpressionEvaluator(ec.functions);
        this.#commandsHandler = new TplCommandsHandler();
        this.#data = data;
    }
    withFragment(fragment) {
        return new Template(fragment, this.#ec, ...this.#data);
    }
    withData(...data) {
        return data.length === 0 ? this : new Template(this.#fragment, this.#ec, ...this.#data, ...data);
    }
    evaluate(expression) {
        return this.#expressionEvaluator.evaluate(expression, ...this.#data);
    }
    evaluateTemplated(expression) {
        return this.#expressionEvaluator.evaluateTemplated(expression, ...this.#data);
    }
    render(...data) {
        const tpl = this.withData(...data);
        try {
            const ops = new NodeOperations(TplCommandsHandler.DATA_PREFIX);
            const fragment = tpl.#fragment.cloneNode(true);
            const nodeFilter = createNodeFilter(TplCommandsHandler.DATA_PREFIX, "{{", "}}");
            const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, nodeFilter);
            let node;
            while ((node = iterator.nextNode()) !== null) {
                let clonedNode = node.cloneNode();
                ops.cleanup();
                if (node.nodeType === Node.TEXT_NODE) {
                    try {
                        tpl.#commandsHandler.textNode(tpl, node, node.nodeValue, ops);
                    } catch (ex) {
                        throw new RenderError("Error evaluating text node", clonedNode, ex);
                    }
                    continue;
                }
                const commands = TplCommandsHandler.ORDERED_COMMANDS;
                for (let i = 0; i !== commands.length; ++i) {
                    const command = commands[i];
                    if (!(command in node.dataset)) {
                        continue;
                    }
                    const value = ops.popData(node, command);
                    try {
                        tpl.#commandsHandler[command](tpl, node, value, ops);
                    } catch (ex) {
                        throw new RenderError(`Error evaluating command ${command}`, clonedNode, ex);
                    }
                }
                Object.keys(node.dataset || {})
                    .filter(k => k.startsWith(TplCommandsHandler.DATA_PREFIX))
                    .map(k => [k, k.substring(TplCommandsHandler.DATA_PREFIX.length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                    .forEach(([dataSetKey, attributeName]) => {
                        const expression = ops.popData(node, dataSetKey);
                        const evaluated = tpl.evaluate(expression);
                        if (typeof evaluated !== 'boolean') {
                            node.setAttribute(attributeName, evaluated);
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
}

class RenderError extends Error {
    constructor(message, nodeOrFragment, cause) {
        const node = nodeOrFragment instanceof DocumentFragment
            ? nodeOrFragment.firstElementChild
            : nodeOrFragment;
        const t = document.createElement("template");
        t.content.appendChild(node.cloneNode(false));
        const repr =  t.innerHTML;
        super(`${message} in ${repr}`, { cause });
        this.name = "RenderError";
        this.node = nodeOrFragment;
    }
}

export { Template, TplCommandsHandler, EvaluationContext };
