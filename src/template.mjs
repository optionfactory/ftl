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

class NodeOperations {
    constructor(){
        this.forRemoval = [];
    }
    remove(node){
        if(node.attributes){
            node.innerHTML = '';
            while (node.attributes.length > 0) {
                node.removeAttribute(node.attributes[0].name);
            }
        }
        this.forRemoval.push(node);
    }
    replace(node, nodes){
        this.forRemoval.push(node);
        dom.addSuccessors(node, nodes);
    }
    cleanup(){
        while (this.forRemoval.length){
             this.forRemoval.pop().remove();
        }
    }
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
        const ops = new NodeOperations();
        const fragment = this.fragment.cloneNode(true);
        const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, isExpressionNode);
        let node;
        while ((node = iterator.nextNode()) !== null) {
            ops.cleanup();
            if (node.nodeType === Node.TEXT_NODE) {
                this.handleTextNode(node, ops, ...data);
                continue;
            }
            //attribute handling priority is defined in this block of code
            if (node.hasAttribute('data-tpl-if')) {
                this.handleAttributeIf(node, ops, ...data);
            }
            if (node.hasAttribute('data-tpl-with')) {
                this.handleAttributeWith(node, ops, ...data);
            }
            if (node.hasAttribute('data-tpl-each')) {
                this.handleAttributeEach(node, ops, ...data);
            }
            if (node.hasAttribute('data-tpl-text')) {
                this.handleAttributeText(node, ops, ...data);
            }
            if (node.hasAttribute('data-tpl-html')) {
                this.handleAttributeHtml(node, ops, ...data);
            }
            if (node.hasAttribute('data-tpl-remove')) {
                this.handleAttributeRemove(node, ops, ...data);
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
        ops.cleanup();
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
    handleAttributeIf(node, ops, ...data) {
        const accept = this.evaluator.evaluate(node.dataset['tplIf'], ...data);
        node.removeAttribute('data-tpl-if');
        if (!accept) {
            node.innerHTML = '';
            ops.remove(node);
        }
    }
    handleAttributeWith(node, ops, ...data) {
        const value = this.evaluator.evaluate(node.dataset['tplWith'], ...data);
        node.removeAttribute("data-tpl-with");
        const varName = node.dataset['tplVar'];
        node.removeAttribute("data-tpl-var");
        const newNode = this.withNode(node).render(...data, varName ? {[varName]: value} : value);
        node.innerHTML = '';
        ops.replace(node, [newNode]);
    }
    handleAttributeEach(node, ops, ...data) {
        const values = this.evaluator.evaluate(node.dataset['tplEach'], ...data);
        node.removeAttribute("data-tpl-each");
        const varName = node.dataset['tplVar'];
        node.removeAttribute("data-tpl-var");

        const nodes = values.map(value => {
            return this.withNode(node).render(...data, varName ? {[varName]: value} : value);
        });
        node.innerHTML = '';
        ops.replace(node, nodes);
    }
    handleAttributeRemove(node, ops, ...data) {
        const command = node.dataset['tplRemove'].toLowerCase();
        node.removeAttribute("data-tpl-remove");
        switch (command) {
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
    handleAttributeText(node, ops, ...data) {
        const text = this.evaluator.evaluate(node.dataset['tplText'], ...data);
        node.removeAttribute("data-tpl-text");
        node.innerHTML = "";
        node.textContent = text;
    }
    handleAttributeHtml(node, ops, ...data) {
        const html = this.evaluator.evaluate(node.dataset['tplHtml'], ...data);
        node.removeAttribute("data-tpl-html");
        node.innerHTML = html;
    }
    handleTextNode(node, ops, ...data) {
        const nodes = this.textNodeEvaluator.evaluate(node.nodeValue, ...data).map(v => {
            return v.t === 't' ? document.createTextNode(v.v) : dom.fragmentFromHtml(v.v);
        });
        ops.replace(node, nodes);
    }
}

export { Template };
