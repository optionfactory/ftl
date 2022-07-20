/* global NodeFilter, Node, DocumentFragment */
import { dom } from "./dom.mjs";


function camelToDash(v){
    return v.split(/(?=[A-Z])/).join('-').toLowerCase();
}

function dashToCamel(v){
    return v.replace(/-([a-z])/g, i => i[1].toUpperCase());
}

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
    constructor(prefix){
        this.prefix = prefix;
        this.forRemoval = [];
    }
    remove(node){
        if('innerHTML' in node){
            node.innerHTML = '';
        }
        if('dataset' in node){
            Object.keys(node.dataset)
                .filter(k => k.startsWith(this.prefix))
                .forEach(k => delete node.dataset[k]);
        }
        this.forRemoval.push(node);
    }
    popData(node, key){
        const v = node.dataset[key];
        delete node.dataset[key];
        return v;
    }
    replace(node, nodes){
        dom.addSuccessors(node, nodes);
        this.remove(node);
    }
    cleanup(){
        while (this.forRemoval.length){
             this.forRemoval.pop().remove();
        }
    }
}


class Template {
    //attribute handling priority is defined in this block of code
    static DATA_PREFIX = 'tpl';
    static COMMANDS = [
        { name: 'If', dataSetKey: 'tplIf', handler: Template.prototype.handleAttributeIf },
        { name: 'With', dataSetKey: 'tplWith', handler: Template.prototype.handleAttributeWith },
        { name: 'Each', dataSetKey: 'tplEach', handler: Template.prototype.handleAttributeEach },
        { name: 'Text', dataSetKey: 'tplText', handler: Template.prototype.handleAttributeText },
        { name: 'Html', dataSetKey: 'tplHtml', handler: Template.prototype.handleAttributeHtml },
        { name: 'Remove', dataSetKey: 'tplRemove', handler: Template.prototype.handleAttributeRemove }
    ];
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
        const ops = new NodeOperations(Template.DATA_PREFIX);

        const fragment = this.fragment.cloneNode(true);
        const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, isExpressionNode);
        let node;
        while ((node = iterator.nextNode()) !== null) {
            ops.cleanup();
            if (node.nodeType === Node.TEXT_NODE) {
                this.handleTextNode(node, node.nodeValue, ops, ...data);
                continue;
            }
            for(let i=0; i != Template.COMMANDS.length ;++i){
                const command = Template.COMMANDS[i];
                if(!(command.dataSetKey in node.dataset)){
                    continue;
                }
                const value = ops.popData(node, command.dataSetKey);
                const hr = command.handler.call(this, node, value, ops, ...data);
            }
            Object.keys(node.dataset)
                .filter(k => k.startsWith(Template.DATA_PREFIX))
                .forEach(k => {
                    const expression = ops.popData(node, k);
                    const evaluated = this.evaluator.evaluate(expression, ...data);
                    const attributeName = camelToDash(k.substring(Template.DATA_PREFIX.length));
                    node.setAttribute(attributeName, evaluated);
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
    handleAttributeIf(node, value, ops, ...data) {
        const accept = this.evaluator.evaluate(value, ...data);
        if (!accept) {
            ops.remove(node);
        }
    }
    handleAttributeWith(node, value, ops, ...data) {
        const evaluated = this.evaluator.evaluate(value, ...data);
        const varName = ops.popData(node, Template.DATA_PREFIX + 'Var');
        const newNode = this.withNode(node).render(...data, varName ? {[varName]: evaluated} : evaluated);
        ops.replace(node, [newNode]);
    }
    handleAttributeEach(node, value, ops, ...data) {
        const varName = ops.popData(node, Template.DATA_PREFIX + 'Var');
        const evaluated = this.evaluator.evaluate(value, ...data);
        const nodes = evaluated.map(v => {
            return this.withNode(node).render(...data, varName ? {[varName]: v} : v);
        });
        ops.replace(node, nodes);
    }
    handleAttributeRemove(node, value, ops, ...data) {
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
    handleAttributeText(node, value, ops, ...data) {
        const text = this.evaluator.evaluate(value, ...data);
        node.innerHTML = "";
        node.textContent = text;
    }
    handleAttributeHtml(node, value, ops, ...data) {
        const html = this.evaluator.evaluate(value, ...data);
        node.innerHTML = html;
    }
    handleTextNode(node, value, ops, ...data) {
        const nodes = this.textNodeEvaluator.evaluate(value, ...data).map(v => {
            return v.t === 't' ? document.createTextNode(v.v) : dom.fragmentFromHtml(v.v);
        });
        ops.replace(node, nodes);
    }
}

export { Template };
