// @ts-ignore
import { parse } from "./expressions-parser.peggy";

class EvaluatingVisitor {
    #modules;
    #dataStack;
    constructor(modules, dataStack) {
        this.#modules = modules;
        this.#dataStack = dataStack;
    }
    and(node) {
        return this.visit(node.lhs) && this.visit(node.rhs);
    }
    or(node) {
        return this.visit(node.lhs) || this.visit(node.rhs);
    }
    not(node) {
        return !this.visit(node.expr);
    }
    eq(node) {
        const lhs = this.visit(node.lhs);
        const rhs = this.visit(node.rhs);
        const eq = lhs === rhs;
        return node.op === "==" ? eq : !eq;
    }
    cmp(node) {
        const lhs = this.visit(node.lhs);
        const rhs = this.visit(node.rhs);
        switch (node.op) {
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
        const module = fnRef.module === null ? this.#modules : this.#modules?.[fnRef.module];
        if (!module) {
            throw new Error(`Module "${fnRef.module}" not found`)
        }
        const fn = module[fnRef.value];
        if (!fn) {
            throw new Error(`Function "#${fnRef.module === null ? '' : fnRef.module + ":"}${fnRef.value}" not found`)
        }
        const args = node.args.map(arg => this.visit(arg));
        return fn.apply(this, args);
    }
    literal(node) {
        return node.value;
    }
    symbol(node) {
        if (node.value === 'self') {
            return this.#dataStack[this.#dataStack.length - 1];
        }
        for (let i = this.#dataStack.length; i !== 0; --i) {
            const overlay = this.#dataStack[i - 1];
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
        let prev = undefined;
        let cur = this.visit(node.lhs);
        for (let i = 0; i !== node.rhs.length; ++i) {
            const rhs = node.rhs[i];
            if(rhs.ns && (cur === null || cur === undefined)){
                return undefined;
            }
            let value = undefined;
            switch(rhs.type){
                case 'dot': {
                    value = cur[rhs.rhs]
                }
                break;
                case 'sub': {
                    value = cur[this.visit(rhs.rhs)]
                }
                break;
                case 'method': {
                    if (!cur){
                        throw new Error(`Method missing "${node.rhs[i - 1].rhs}"`)
                    }
                    const args = rhs.args.map(arg => this.visit(arg));
                    value = cur.apply(prev, args);
                }
                break;
            }
            prev = cur;
            cur = value;
        }
        return cur;
    }
    visit(node, ...args) {
        return this[node.type](node, ...args);
    }
    visitRoot(ast, templated) {
        return !templated ? this.visit(ast) : ast.map(node => {
            switch (node.type) {
                case 'tel': return { type: 't', value: node.value };
                case 'tet': return { type: 't', value: this.visit(node.value) };
                case 'teh': return { type: 'h', value: this.visit(node.value) };
                case 'ten': return { type: 'n', value: this.visit(node.value) };
                default: throw new Error("unknown node type " + node.type);
            }
        });
    }
}

class Expressions {
    static MODE_EXPRESSION = Symbol("MODE_EXPRESSION");
    static MODE_TEMPLATED = Symbol("MODE_TEMPLATED");

    /**
     * Parses an expression.
     * @param {string} expression
     * @param {(Expressions.MODE_EXPRESSION | Expressions.MODE_TEMPLATED)?} [mode]
     * @returns the ast
     */
    static parse(expression, mode) {
        return parse(expression, { startRule: mode === Expressions.MODE_TEMPLATED ? 'TemplatedRoot' : 'ExpressionRoot' });
    }
    /**
     * Evaluates an expression.
     * @param {{[k: string]: any } | null | undefined } modules
     * @param {any[]} dataStack
     * @param {any} ast
     * @param {(Expressions.MODE_EXPRESSION | Expressions.MODE_TEMPLATED)?} [mode]
     * @returns the result
     */
    static evaluate(modules, dataStack, ast, mode) {
        return new EvaluatingVisitor(modules, dataStack).visitRoot(ast, mode === Expressions.MODE_TEMPLATED);
    }
    /**
     * Parses and evaluates an expression.
     * @param {{ [x: string]: any; } | null | undefined} modules
     * @param {any[]} dataStack
     * @param {string} expression
     * @param {(Expressions.MODE_EXPRESSION | Expressions.MODE_TEMPLATED)?} [mode]
     * @returns the result
     */
    static interpret(modules, dataStack, expression, mode) {
        return Expressions.evaluate(modules, dataStack, Expressions.parse(expression, mode), mode);
    }

}


export { Expressions };
