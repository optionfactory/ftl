import { parse } from "./expressions-parser.mjs";
import { parse as parseTextNode } from "./expressions-textnode-parser.mjs";

class EvaluatingVisitor {
    constructor(dataStack, functions) {
        this.dataStack = dataStack;
        this.functions = functions;
    }
    call(node) {
        const fnRef = node.value;
        const module = fnRef.module.reduce((acc, m) => acc[m], this.functions);
        const args = node.args.map(arg => this.visit(arg));
        return module[fnRef.value].call(this, args);
    }
    nav(node) {
        const from = this.visit(node.from);
        const values = [from];
        for (let i = 0; i !== node.to.length; ++i) {
            const res = this.visit(node.to[i], values[i], values[i - 1]);
            if (res.length === 0) {
                return values[values.length - 1];
            }
            values.push(res[0]);
        }
        return values[values.length - 1];
    }
    literal(node) {
        return node.value;
    }
    symbol(node) {
        if (node.value === 'self') {
            return this.dataStack[this.dataStack.length - 1];
        }
        for (let i = this.dataStack.length; i !== 0; --i) {
            const overlay = this.dataStack[i - 1];
            if (overlay.hasOwnProperty(node.value)) {
                return overlay[node.value];
            }
        }
        return undefined;
    }
    cond(node, from) {
        return from ? (node.ifTrue === null ? from : this.visit(node.ifTrue)) : this.visit(node.ifFalse);
    }
    dict(node) {
        return node.value.map(entry => [entry[0].value, this.visit(entry[1])]);
    }
    array(node) {
        return node.value.map(v => this.visit(v));
    }
    //navto
    dot(node, from) {
        if (node.ns && (from === null || from === undefined)) {
            return [];
        }
        return [from[node.value]];
    }
    sub(node, from) {
        if (node.ns && (from === null || from === undefined)) {
            return [];
        }
        return [from[this.visit(node.value)]];
    }
    method(node, fn, scope) {
        if (node.ns && (fn === null || fn === undefined)) {
            return [];
        }
        const args = node.value.map(arg => this.visit(arg));
        return [fn.call(scope, args)];
    }
    //
    visit(node, ...args) {
        return this[node.type](node, ...args);
    }
}

class ExpressionEvaluator {
    constructor(functions) {
        this.functions = functions || {};
    }
    parse(expression) {
        return parse(expression);
    }
    evaluateAst(ast, dataStack) {
        return new EvaluatingVisitor(dataStack, this.functions).visit(ast);
    }
    evaluate(expression, ...data) {
        return this.evaluateAst(this.parse(expression), data);
    }
}

class TextNodeExpressionEvaluator {
    constructor(evaluator) {
        this.evaluator = evaluator;
    }
    parse(expression) {
        return parseTextNode(expression).map(node => node.t === 't' ? node : {
            t: node.t,
            v: this.evaluator.parse(node.v)
        });
    }
    evaluateAst(ast, dataStack) {
        return ast.map(node => node.t === 't' ? node : {
            t: node.t === 'te' ? 't' : 'h',
            v: this.evaluator.evaluateAst(node.v, dataStack)
        });
    }
    evaluate(expression, ...data) {
        return this.evaluateAst(this.parse(expression), data);
    }
}


export { ExpressionEvaluator, TextNodeExpressionEvaluator };
