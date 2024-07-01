/* global NodeFilter, Node, DocumentFragment */
import { Fragments } from "./fragments.mjs";
import { ExpressionEvaluator, TextNodeExpressionEvaluator } from "./expressions.mjs";

function createNodeFilter(dataPrefix, textNodeExpressionStart, textNodeExpressionEnd) {
    const attributePrefix = `data-${dataPrefix}-`;
    return function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.indexOf(textNodeExpressionStart) !== -1 && node.nodeValue.indexOf(textNodeExpressionEnd) !== -1
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
        return Array.from(node.attributes).some(attr => attr.name.startsWith(attributePrefix))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
    };
}

class NodeOperations {
    constructor(prefix) {
        this.prefix = prefix;
        this.forRemoval = [];
    }

    remove(node) {
        node.replaceChildren?.();
        Object.keys(node.dataset || {})
            .filter(k => k.startsWith(this.prefix))
            .forEach(k => delete node.dataset[k]);
        this.forRemoval.push(node);
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
        while (this.forRemoval.length) {
            this.forRemoval.pop().remove();
        }
    }
}

class TplCommandsHandler {

    dataPrefix() {
        return TplCommandsHandler.DATA_PREFIX;
    }

    orderedCommands() {
        return TplCommandsHandler.COMMANDS;
    }

    tplIf(template, node, value, ops, ...data) {
        const accept = template.ec.evaluator.evaluate(value, ...data);
        if (!accept) {
            ops.remove(node);
        }
    }

    tplWith(template, node, value, ops, ...data) {
        const evaluated = template.ec.evaluator.evaluate(value, ...data);
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const newNode = template.withNode(node).render(...data, varName ? { [varName]: evaluated } : evaluated);
        ops.replace(node, [newNode]);
    }

    tplEach(template, node, value, ops, ...data) {
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const evaluated = template.ec.evaluator.evaluate(value, ...data);
        const nodes = evaluated.map(v => {
            return template.withNode(node).render(...data, varName ? { [varName]: v } : v);
        });
        ops.replace(node, nodes);
    }

    tplRemove(template, node, value, ops, ...data) {
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

    tplText(template, node, value, ops, ...data) {
        const text = template.ec.evaluator.evaluate(value, ...data);
        const newNode = node.cloneNode();
        newNode.replaceChildren(text === null || text === undefined ? "" : text);
        ops.replace(node, [newNode]);
    }

    tplValue(template, node, value, ops, ...data) {
        node.value = template.ec.evaluator.evaluate(value, ...data);
    }

    tplHtml(template, node, value, ops, ...data) {
        const html = template.ec.evaluator.evaluate(value, ...data);
        const newNode = node.cloneNode();
        newNode.innerHTML = html === null || html === undefined ? "" : html;
        ops.replace(node, [newNode]);
    }

    tplClassAppend(template, node, value, ops, ...data) {
        const classes = template.ec.evaluator.evaluate(value, ...data);
        const classesAsArray = Array.isArray(classes) ? classes : [classes];
        node.classList.add(...classesAsArray);
    }

    tplAttrAppend(template, node, value, ops, ...data) {
        const attributesAndValues = template.ec.evaluator.evaluate(value, ...data);
        if (attributesAndValues.length === 0) {
            return;
        }
        const tuples = Array.isArray(attributesAndValues[0]) ? attributesAndValues : [attributesAndValues];
        tuples.forEach(([k, v]) => {
            node.setAttribute(k, v);
        });
    }

    textNode(template, node, value, ops, ...data) {
        const nodes = template.ec.textNodeEvaluator.evaluate(value, ...data)
            .map(v => {
                switch (v.t) {
                    case 't': return document.createTextNode(v.v === null || v.v === undefined ? "" : v.v);
                    case 'h': return Fragments.fromHtml(v.v === null || v.v === undefined ? "" : v.v);
                    case 'n': return v.v;
                }
            });
        ops.replace(node, nodes);
    }
}

TplCommandsHandler.DATA_PREFIX = 'tpl';
TplCommandsHandler.COMMANDS = ['tplIf', 'tplWith', 'tplEach', 'tplValue', 'tplClassAppend', 'tplAttrAppend', 'tplText', 'tplHtml', 'tplRemove'];

class EvaluationContext {
    constructor({ evaluator, textNodeEvaluator, commandsHandler }) {
        this.evaluator = evaluator;
        this.textNodeEvaluator = textNodeEvaluator;
        this.commandsHandler = commandsHandler;
    }
    withModule(name, functions) {
        const fns = {
            ...this.evaluator.functions,
            [name]: functions,
        };
        return EvaluationContext.configure(fns);
    }
    withModules(functions) {
        const fns = {
            ...this.evaluator.functions,
            ...functions,
        };
        return EvaluationContext.configure(fns);
    }
    static configure(functions) {
        const ee = new ExpressionEvaluator(functions);
        const tnee = new TextNodeExpressionEvaluator(ee);
        const ch = new TplCommandsHandler();
        return new EvaluationContext({
            evaluator: ee,
            textNodeEvaluator: tnee,
            commandsHandler: ch
        });
    }
}

class Template {
    /**
     * 
     * @param {string} html 
     * @param {EvaluationContext} ec 
     * @returns the template
     */
    static fromHtml(html, ec) {
        return new Template(Fragments.fromHtml(html), ec);
    }

    /**
     * 
     * @param {string} selector for an HTMLTemplateElement
     * @param {EvaluationContext} ec 
     * @returns the template
     */
    static fromSelector(selector, ec) {
        const templateEl = document.querySelector(selector);
        const fragment = templateEl.content;
        return new Template(fragment, ec);
    }

    /**
     * 
     * @param {HTMLTemplateElement} templateEl 
     * @param {EvaluationContext} ec 
     * @returns the template
     */
    static fromTemplate(templateEl, ec) {
        const fragment = templateEl.content;
        return new Template(fragment, ec);
    }

    /**
     * 
     * @param {DocumentFragment} fragment 
     * @param {EvaluationContext} ec 
     * @returns the template
     */
    static fromFragment(fragment, ec) {
        return new Template(fragment, ec);
    }

    constructor(fragment, ec) {
        this.fragment = fragment;
        this.ec = ec;
    }
    withNode(node) {
        const fragment = new DocumentFragment();
        fragment.appendChild(node.cloneNode(true));
        return new Template(fragment, this.ec);
    }
    render(...data) {
        try {
            const dataPrefix = this.ec.commandsHandler.dataPrefix();
            const ops = new NodeOperations(dataPrefix);
            const fragment = this.fragment.cloneNode(true);
            const nodeFilter = createNodeFilter(dataPrefix, "{{", "}}");
            const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, nodeFilter);
            let node;
            while ((node = iterator.nextNode()) !== null) {
                let clonedNode = node.cloneNode();
                ops.cleanup();
                if (node.nodeType === Node.TEXT_NODE) {
                    try {
                        this.ec.commandsHandler.textNode(this, node, node.nodeValue, ops, ...data);
                    } catch (ex) {
                        throw new RenderError(ex.message, clonedNode, ex);
                    }
                    continue;
                }
                const commands = this.ec.commandsHandler.orderedCommands();
                for (let i = 0; i !== commands.length; ++i) {
                    const command = commands[i];
                    if (!(command in node.dataset)) {
                        continue;
                    }
                    const value = ops.popData(node, command);
                    try {
                        this.ec.commandsHandler[command](this, node, value, ops, ...data);
                    } catch (ex) {
                        throw new RenderError(ex.message, clonedNode, ex);
                    }
                }
                Object.keys(node.dataset || {})
                    .filter(k => k.startsWith(this.ec.commandsHandler.dataPrefix()))
                    .map(k => [k, k.substring(this.ec.commandsHandler.dataPrefix().length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                    .forEach(([dataSetKey, attributeName]) => {
                        const expression = ops.popData(node, dataSetKey);
                        const evaluated = this.ec.evaluator.evaluate(expression, ...data);
                        node.setAttribute(attributeName, evaluated);
                    });
            }
            ops.cleanup();
            return fragment;
        } catch (ex) {
            throw new RenderError(ex.message, this.fragment, ex)
        }
    }


    renderTo(el, ...data) {
        const fragment = this.render(...data);
        el.replaceChildren(fragment);
    }

    renderToSelector(selector, ...data) {
        const el = document.querySelector(selector);
        this.renderTo(el, ...data);
    }

    appendTo(el, ...data) {
        const fragment = this.render(...data);
        el.appendChild(fragment);
    }

    appendToSelector(selector, ...data) {
        const el = document.querySelector(selector);
        this.appendTo(el, ...data);
    }

}

class RenderError extends Error {

    constructor(message, cause, inner) {
        if (inner instanceof RenderError) {
            var r = document.createElement("root");
            r.appendChild(inner.cause);
            const _message = message + "\n\t--> " + r.innerHTML;
            super(_message);
        } else {
            super(message);
        }
        this.name = "RenderError";
        this.cause = cause;
    }
}

export { Template, TplCommandsHandler, EvaluationContext };
