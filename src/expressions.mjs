import { parse } from "./expressions-parser.peggy";
import { parse as parseTextNode } from "./expressions-textnode-parser.peggy";

class EvaluatingVisitor {
    constructor(dataStack, functions) {
        this.dataStack = dataStack;
        this.functions = functions;
    }
    and(node){
        return this.visit(node.lhs) && this.visit(node.rhs);
    }
    or(node){
        return this.visit(node.lhs) || this.visit(node.rhs);
    }
    not(node){
        return !this.visit(node.expr);
    }
    eq(node){
        const lhs = this.visit(node.lhs);
        const rhs = this.visit(node.rhs);
        const eq = lhs === rhs;
        return node.op === "==" ? eq : !eq;
    }
    cmp(node){
        const lhs = this.visit(node.lhs);
        const rhs = this.visit(node.rhs);
        switch(node.op){
            case ">":
                return lhs > rhs;
            case "<":
                return lhs < rhs;
            case ">=":
                return lhs >= rhs;
            case "<=":
                return lhs <= rhs;
        }   
    }
    call(node) {
        const fnRef = node.value;
        const module = fnRef.module == null ? this.functions :  this.functions[fnRef.module];
        if (!module){
            throw new Error(`Module "${fnRef.module}" not found`)
        }
        const fn = module[fnRef.value];
        if (!fn){
            throw new Error(`Function "#${fnRef.module == null ? '' : fnRef.module+":"}${fnRef.value}" not found`)
        }
        const args = node.args.map(arg => this.visit(arg));
        return fn.apply(this, args);
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
    dict(node) {
        return Object.fromEntries(node.value.map(entry => [entry[0].value, this.visit(entry[1])]));
    }
    array(node) {
        return node.value.map(v => this.visit(v));
    }
    ter(node) {
        return this.visit(node.cond) ? this.visit(node.ifTrue) : this.visit(node.ifFalse);
    }    
    nav(node) {
        const from = this.visit(node.lhs);
        const values = [from];
        for (let i = 0; i !== node.rhs.length; ++i) {
            const res = this.visit(node.rhs[i], values[i], values[i - 1], node.rhs[i - 1] );
            if (res.length === 0) {
                return undefined;
            }
            values.push(res[0]);
        }
        return values[values.length - 1];
    }
    //navto
    dot(node, from) {
        if(node.ns && (from === null || from === undefined)){
            return [];
        }
        return [from[node.rhs]];
    }
    sub(node, from) {
        if (node.ns && (from === null || from === undefined)) {
            return [];
        }
        return [from[this.visit(node.rhs)]];
    }
    method(node, fn, scope, caller) {
        if (node.ns && (fn === null || fn === undefined)) {
            return [];
        }
        if (!fn){
            throw new Error(`Method missing "${caller.rhs}"`)
        }
        const args = node.args.map(arg => this.visit(arg));
        return [fn.apply(scope, args)];
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
        return ast.map(node => {
            switch(node.t){
                case 't': return node;
                case 'te': return {t: 't', v: this.evaluator.evaluateAst(node.v, dataStack)};
                case 'he': return {t: 'h', v: this.evaluator.evaluateAst(node.v, dataStack)};
                case 'ne': return {t: 'n', v: this.evaluator.evaluateAst(node.v, dataStack)};
            }
        });
    }
    evaluate(expression, ...data) {
        return this.evaluateAst(this.parse(expression), data);
    }
}


export { ExpressionEvaluator, TextNodeExpressionEvaluator };
