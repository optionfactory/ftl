/* global NodeFilter, Node, DocumentFragment */
import { dom } from "./dom.mjs";
import { ExpressionEvaluator,  TextNodeExpressionEvaluator} from "./expressions.mjs";

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
        if ('innerHTML' in node) {
            node.innerHTML = '';
        }
        if ('dataset' in node) {
            Object.keys(node.dataset)
                .filter(k => k.startsWith(this.prefix))
                .forEach(k => delete node.dataset[k]);
        }
        this.forRemoval.push(node);
    }

    popData(node, key) {
        const v = node.dataset[key];
        delete node.dataset[key];
        return v;
    }

    replace(node, nodes) {
        dom.addSuccessors(node, nodes);
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
        const accept = template.evaluator.evaluate(value, ...data);
        if (!accept) {
            ops.remove(node);
        }
    }

    tplWith(template, node, value, ops, ...data) {
        const evaluated = template.evaluator.evaluate(value, ...data);
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const newNode = template.withNode(node).render(...data, varName ? { [varName]: evaluated } : evaluated);
        ops.replace(node, [newNode]);
    }

    tplEach(template, node, value, ops, ...data) {
        const varName = ops.popData(node, TplCommandsHandler.DATA_PREFIX + 'Var');
        const evaluated = template.evaluator.evaluate(value, ...data);
        const nodes = evaluated.map(v => {
            return template.withNode(node).render(...data, varName ? { [varName]: v } : v);
        });
        ops.replace(node, nodes);
    }

    tplRemove(template, node, value, ops, ...data) {
        switch (value.toLowerCase()) {
            case 'tag':
                ops.replace(node, node.childNodes);
                break;
            case 'body':
                node.innerHTML = '';
                break;
            case 'all':
                ops.remove(node);
                break;
        }
    }

    tplText(template, node, value, ops, ...data) {
        const text = template.evaluator.evaluate(value, ...data);
        node.innerHTML = "";
        node.textContent = text;
    }

    tplValue(template, node, value, ops, ...data) {
        node.value = template.evaluator.evaluate(value, ...data);
    }

    tplHtml(template, node, value, ops, ...data) {
        const html = template.evaluator.evaluate(value, ...data);
        node.innerHTML = html;
    }

    tplClassAppend(template, node, value, ops, ...data) {
        const classes = template.evaluator.evaluate(value, ...data);
        const classesAsArray = Array.isArray(classes) ? classes : [classes];
        node.classList.add(...classesAsArray);
    }

    tplAttrAppend(template, node, value, ops, ...data) {
        const attributesAndValues = template.evaluator.evaluate(value, ...data);
        if (attributesAndValues.length === 0) {
            return;
        }
        const tuples = Array.isArray(attributesAndValues[0]) ? attributesAndValues : [attributesAndValues];
        tuples.forEach(([k, v]) => {
            node.setAttribute(k, v);
        });
    }

    textNode(template, node, value, ops, ...data) {
        const nodes = template.textNodeEvaluator.evaluate(value, ...data)
            .map(v => {
                switch (v.t) {
                    case 't': return document.createTextNode(v.v);
                    case 'h': return dom.fragmentFromHtml(v.v);
                    case 'n': return v.v;
                }
            });
        ops.replace(node, nodes);
    }
}

TplCommandsHandler.DATA_PREFIX = 'tpl';
TplCommandsHandler.COMMANDS = ['tplIf', 'tplWith', 'tplEach', 'tplValue', 'tplClassAppend', 'tplAttrAppend', 'tplText', 'tplHtml', 'tplRemove'];

class EvaluationContext {
    constructor({evaluator, textNodeEvaluator, commandsHandler }){
        this.evaluator = evaluator;
        this.textNodeEvaluator = textNodeEvaluator;
        this.commandsHandler = commandsHandler;
    }
    static configure(functions){
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
    static fromHtml(html, ec) {
        return new Template(dom.fragmentFromHtml(html), ec);
    }

    static fromNodes(nodes, ec) {
        return new Template(dom.fragmentFromNodes(true, false, ...nodes), ec);
    }

    static fromNode(node, ec) {
        return new Template(dom.fragmentFromNodes(true, true, node), ec);
    }

    static fromSelector(selector, ec) {
        const node = document.querySelector(selector);
        return new Template(dom.fragmentFromNodes(true, true, node), ec);
    }

    static render(fragment, ec, ...data) {
        return new Template(fragment, ec).render(...data);
    }

    static renderTo(fragment, ec, el, ...data) {
        return new Template(fragment, ec).renderTo(el, ...data);
    }

    static renderToSelector(fragment, ec, selector, ...data) {
        return new Template(fragment, ec).renderToSelector(selector, ...data);
    }

    static appendTo(fragment, ec, el, ...data) {
        return new Template(fragment, ec).appendTo(el, ...data);
    }

    static appendToSelector(fragment, ec, selector, ...data) {
        return new Template(fragment, ec).appendToSelector(selector, ...data);
    }

    constructor(fragment, { evaluator, textNodeEvaluator, commandsHandler }) {
        this.fragment = fragment;
        this.evaluator = evaluator;
        this.textNodeEvaluator = textNodeEvaluator;
        this.commandsHandler = commandsHandler || new TplCommandsHandler();
    }
    withNode(node) {
        const evaluator = this.evaluator;
        const textNodeEvaluator = this.textNodeEvaluator;
        const commandsHandler = this.commandsHandler;
        return Template.fromNode(node, { evaluator, textNodeEvaluator, commandsHandler });
    }

    _render(...data) {
        const dataPrefix = this.commandsHandler.dataPrefix();
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
                    this.commandsHandler.textNode(this, node, node.nodeValue, ops, ...data);
                } catch (ex) {
                    throw new RenderError(ex.message, clonedNode, ex);
                }
                continue;
            }
            const commands = this.commandsHandler.orderedCommands();
            for (let i = 0; i !== commands.length; ++i) {
                const command = commands[i];
                if (!(command in node.dataset)) {
                    continue;
                }
                const value = ops.popData(node, command);
                try {
                    this.commandsHandler[command](this, node, value, ops, ...data);
                } catch (ex) {
                    throw new RenderError(ex.message, clonedNode, ex);
                }
            }
            Object.keys(node.dataset)
                .filter(k => k.startsWith(this.commandsHandler.dataPrefix()))
                .map(k => [k, k.substring(this.commandsHandler.dataPrefix().length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                .forEach(([dataSetKey, attributeName]) => {
                    const expression = ops.popData(node, dataSetKey);
                    const evaluated = this.evaluator.evaluate(expression, ...data);
                    node.setAttribute(attributeName, evaluated);
                });
        }
        ops.cleanup();
        return fragment;
    }

    render(...data) {
        try {
            return this._render(...data);
        } catch (ex) {
            throw new RenderError(ex.message, this.fragment, ex)
        }
    }

    renderTo(el, ...data) {
        let fragment = this.render(...data);
        el.innerHTML = '';
        el.appendChild(fragment);
    }

    renderToSelector(selector, ...data) {
        const el = document.querySelector(selector);
        this.renderTo(el, ...data);
    }

    appendTo(el, ...data) {
        let fragment = this.render(...data);
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
