import { parse } from "./expressions-parser.peggy";

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
            default:
                throw new Error("unknown cmp op " + node.op);
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
        let prev = undefined;
        let cur = from;
        for (let i = 0; i !== node.rhs.length; ++i) {
            const res = this.visit(node.rhs[i], cur, prev, node.rhs[i - 1] );
            if (res.length === 0) {
                return undefined;
            }
            prev = cur;
            cur = res[0];
        }
        return cur;
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
    visit(node, ...args) {
        return this[node.type](node, ...args);
    }
}

class ExpressionEvaluator {
    constructor(functions) {
        this.functions = functions || {};
    }
    parse(expression) {
        return parse(expression, { startRule: 'ExpressionRoot'});
    }
    evaluateAst(ast, dataStack) {
        return new EvaluatingVisitor(dataStack, this.functions).visit(ast);
    }
    evaluate(expression, ...data) {
        return this.evaluateAst(this.parse(expression), data);
    }
    parseTemplated(expression) {
        return parse(expression, { startRule: 'TemplatedRoot'});
    }
    evaluateTemplatedAst(ast, dataStack) {
        const ev = new EvaluatingVisitor(dataStack, this.functions);
        return ast.map(node => {
            switch(node.type){
                case 'tel': return {type: 't', value: node.value};
                case 'tet': return {type: 't', value: ev.visit(node.value)};
                case 'teh': return {type: 'h', value: ev.visit(node.value)};
                case 'ten': return {type: 'n', value: ev.visit(node.value)};
                default: throw new Error("unknown node type " + node.type);
            }
        });
    }
    evaluateTemplated(expression, ...data) {
        return this.evaluateTemplatedAst(this.parseTemplated(expression), data);
    }    
}

export { ExpressionEvaluator };
