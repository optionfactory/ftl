/* global NodeFilter, Node, DocumentFragment */
import { dom } from "./dom.mjs";



function isExpressionNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue.indexOf("{{") !== -1 && node.nodeValue.indexOf("}}") !== -1
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
    }
    return Array.from(node.attributes).some(attr => attr.name.startsWith("data-tpl-"))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
}

class Template {
    evaluator;
    textNodeEvaluator;
    fragment;
    static fromHtml(html, evaluator, textNodeEvaluator) {
        return new Template({fragment: dom.fragmentFromHtml(html), evaluator, textNodeEvaluator});
    }
    static fromNodes(nodes, evaluator, textNodeEvaluator) {
        return new Template({fragment: dom.fragmentFromNodes(true, ...nodes), evaluator, textNodeEvaluator});
    }
    static fromNode(node, evaluator, textNodeEvaluator) {
        return new Template({fragment: dom.fragmentFromNodes(true, node), evaluator, textNodeEvaluator});
    }
    static render(conf, ...data) {
        return new Template(conf).render(...data);
    }
    static renderTo(conf, el, ...data) {
        return new Template(conf).renderTo(el, ...data);
    }
    static appendTo(conf, el, ...data) {
        return new Template(conf).appendTo(el, ...data);
    }
    constructor( {fragment, evaluator, textNodeEvaluator}) {
        this.evaluator = evaluator;
        this.textNodeEvaluator = textNodeEvaluator;
        this.fragment = fragment;
    }
    withNode(node) {
        return Template.fromNode(node, this.evaluator, this.textNodeEvaluator);
    }
    render(...data) {
        const fragment = this.fragment.cloneNode(true);
        const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, isExpressionNode);
        const toBeRemoved = [];
        let node;
        while ((node = iterator.nextNode()) !== null) {
            if (node.nodeType === Node.TEXT_NODE) {
                this.handleTextNode(node, toBeRemoved, ...data);
                continue;
            }
            //attribute handling priority is defined in this block of code
            if (node.hasAttribute('data-tpl-if')) {
                this.handleAttributeIf(node, toBeRemoved, ...data);
            }
            if (node.hasAttribute('data-tpl-with')) {
                this.handleAttributeWith(node, toBeRemoved, ...data);
            }
            if (node.hasAttribute('data-tpl-each')) {
                this.handleAttributeEach(node, toBeRemoved, ...data);
            }
            if (node.hasAttribute('data-tpl-text')) {
                this.handleAttributeText(node, toBeRemoved, ...data);
            }
            if (node.hasAttribute('data-tpl-html')) {
                this.handleAttributeHtml(node, toBeRemoved, ...data);
            }
            if (node.hasAttribute('data-tpl-remove')) {
                this.handleAttributeRemove(node, toBeRemoved, ...data);
            }
            const prefix = "data-tpl-";
            Array.from(node.attributes)
                    .filter(({name}) => name.startsWith(prefix))
                    .forEach(({name}) => {
                        const key = name.substring(prefix.length);
                        const expression = node.getAttribute(name);
                        const evaluated = this.evaluator.evaluate(expression, ...data);
                        node.setAttribute(key, evaluated);
                        node.removeAttribute(name);
                    });
        }
        toBeRemoved.forEach(el => el.remove());
        return fragment;
    }
    renderTo(el, ...data) {
        const fragment = this.render(...data);
        el.innerHTML = '';
        el.appendChild(fragment);
    }
    appendTo(el, ...data) {
        const fragment = this.render(...data);
        el.appendChild(fragment);
    }
    handleAttributeIf(node, toBeRemoved, ...data) {
        const accept = this.evaluator.evaluate(node.dataset['tplIf'], ...data);
        node.removeAttribute('data-tpl-if');
        if (!accept) {
            node.innerHTML = '';
            toBeRemoved.push(node);
        }
    }
    handleAttributeWith(node, toBeRemoved, ...data) {
        const value = this.evaluator.evaluate(node.dataset['tplWith'], ...data);
        node.removeAttribute("data-tpl-with");
        const varName = node.dataset['tplVar'];
        node.removeAttribute("data-tpl-var");
        const newNode = this.withNode(node).render(...data, varName ? {[varName]: value} : value);
        node.innerHTML = '';
        dom.addSuccessors(node, [newNode]);
        toBeRemoved.push(node);
    }
    handleAttributeEach(node, toBeRemoved, ...data) {
        const values = this.evaluator.evaluate(node.dataset['tplEach'], ...data);
        node.removeAttribute("data-tpl-each");
        const varName = node.dataset['tplVar'];
        node.removeAttribute("data-tpl-var");

        const nodes = values.map(value => {
            return this.withNode(node).render(...data, varName ? {[varName]: value} : value);
        });
        node.innerHTML = '';
        dom.addSuccessors(node, nodes);
        toBeRemoved.push(node);
    }
    handleAttributeRemove(node, toBeRemoved, ...data) {
        const command = node.dataset['tplRemove'].toLowerCase();
        node.removeAttribute("data-tpl-remove");
        switch (command) {
            case 'tag':
                dom.addSuccessors(node, node.childNodes);
                toBeRemoved.push(node);
                break;
            case 'body':
                node.innerHTML = '';
                break;
            case 'all':
                toBeRemoved.push(node);
                break;
        }
    }
    handleAttributeText(node, toBeRemoved, ...data) {
        const text = this.evaluator.evaluate(node.dataset['tplText'], ...data);
        node.removeAttribute("data-tpl-text");
        node.innerHTML = "";
        node.textContent = text;
    }
    handleAttributeHtml(node, toBeRemoved, ...data) {
        const html = this.evaluator.evaluate(node.dataset['tplHtml'], ...data);
        node.removeAttribute("data-tpl-html");
        node.innerHTML = html;
    }
    handleTextNode(node, toBeRemoved, ...data) {
        const nodes = this.textNodeEvaluator.evaluate(node.nodeValue, ...data).map(v => {
            return v.t === 't' ? document.createTextNode(v.v) : dom.fragmentFromHtml(v.v);
        });
        dom.addSuccessors(node, nodes);
        toBeRemoved.push(node);
    }
}

export { Template };
