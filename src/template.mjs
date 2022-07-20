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

class DefaultCommandsHandler {
    static DATA_PREFIX = 'tpl';
    static COMMANDS = ['tplIf','tplWith','tplEach','tplText','tplHtml','tplRemove'];

    dataPrefix(){
        return DefaultCommandsHandler.DATA_PREFIX;
    }
    orderedCommands() {
        return DefaultCommandsHandler.COMMANDS;
    }
    tplIf(template, node, value, ops, ...data) {
        const accept = template.evaluator.evaluate(value, ...data);
        if (!accept) {
            ops.remove(node);
        }
    }
    tplWith(template, node, value, ops, ...data) {
        const evaluated = template.evaluator.evaluate(value, ...data);
        const varName = ops.popData(node, Template.DATA_PREFIX + 'Var');
        const newNode = this.withNode(node).render(...data, varName ? {[varName]: evaluated} : evaluated);
        ops.replace(node, [newNode]);
    }
    tplEach(template, node, value, ops, ...data) {
        const varName = ops.popData(node, Template.DATA_PREFIX + 'Var');
        const evaluated = template.evaluator.evaluate(value, ...data);
        const nodes = evaluated.map(v => {
            return template.withNode(node).render(...data, varName ? {[varName]: v} : v);
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
    tplHtml(template, node, value, ops, ...data) {
        const html = template.evaluator.evaluate(value, ...data);
        node.innerHTML = html;
    }
    textNode(template, node, value, ops, ...data) {
        const nodes = template.textNodeEvaluator.evaluate(value, ...data).map(v => {
            return v.t === 't' ? document.createTextNode(v.v) : dom.fragmentFromHtml(v.v);
        });
        ops.replace(node, nodes);
    }
}


class Template {
    fragment;
    evaluator;
    textNodeEvaluator;
    commandsHandler;

    static fromHtml(html, evaluator, textNodeEvaluator, commandsHandler) {
        return new Template({fragment: dom.fragmentFromHtml(html), evaluator, textNodeEvaluator, commandsHandler});
    }
    static fromNodes(nodes, evaluator, textNodeEvaluator, commandsHandler) {
        return new Template({fragment: dom.fragmentFromNodes(true, ...nodes), evaluator, textNodeEvaluator, commandsHandler});
    }
    static fromNode(node, evaluator, textNodeEvaluator, commandsHandler) {
        return new Template({fragment: dom.fragmentFromNodes(true, node), evaluator, textNodeEvaluator, commandsHandler});
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
    constructor( {fragment, evaluator, textNodeEvaluator, commandsHandler}) {
        this.fragment = fragment;
        this.evaluator = evaluator;
        this.textNodeEvaluator = textNodeEvaluator;
        this.commandsHandler = commandsHandler || new DefaultCommandsHandler();
    }
    withNode(node) {
        return Template.fromNode(node, this.evaluator, this.textNodeEvaluator, this.commandsHandler);
    }
    render(...data) {
        const ops = new NodeOperations(this.commandsHandler.dataPrefix());
        const fragment = this.fragment.cloneNode(true);
        const iterator = document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, isExpressionNode);
        let node;
        while ((node = iterator.nextNode()) !== null) {
            ops.cleanup();
            if (node.nodeType === Node.TEXT_NODE) {
                this.commandsHandler.textNode(this, node, node.nodeValue, ops, ...data);
                continue;
            }
            const commands = this.commandsHandler.orderedCommands();
            for(let i=0; i != commands.length ;++i){
                const command = commands[i];
                if(!(command in node.dataset)){
                    continue;
                }
                const value = ops.popData(node, command);
                this.commandsHandler[command](this, node, value, ops, ...data);
            }
            Object.keys(node.dataset)
                .filter(k => k.startsWith(this.commandsHandler.dataPrefix()))
                .map(k => [k, k.substring(this.commandsHandler.dataPrefix().length).split(/(?=[A-Z])/).join('-').toLowerCase()])
                .forEach(([dataSetKey, attributeName])=> {
                    const expression = ops.popData(node, dataSetKey);
                    const evaluated = this.evaluator.evaluate(expression, ...data);
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

}

export { 
    Template,
    DefaultCommandsHandler
};
