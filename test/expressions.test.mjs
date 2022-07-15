import {ExpressionEvaluator } from "../src/expressions.mjs";

import assert from 'assert';

describe('Expression', () => {
    it('can navigate', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a.b.c", {a: {b: {c: 1}}});
        assert.strictEqual(result, 1);
    });
    it('nullsafe nav', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a?.b.c", {});
        assert.strictEqual(result, undefined);
    });
    it('can call a method', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a.b.c.toLowerCase()", {a: {b: {c: "M"}}});
        assert.strictEqual(result, "m");
    });
    it('can evaluate a boolean literal (true)', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("true", {});
        assert.strictEqual(result, true);
    });
    it('can evaluate a boolean literal (false)', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("false", {});
        assert.strictEqual(result, false);
    });
    it('can evaluate self', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("self", "MARIO");
        assert.strictEqual(result, "MARIO");
    });
    it('can call a function', () => {
        let evaluator = new ExpressionEvaluator({
            math: { 
                isEven: (v) => v%2===0 
            }
        });
        let result = evaluator.evaluate("#math:isEven(2)", {});
        assert.strictEqual(result, true);
    });    
    it('can use overlays', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a", {}, {a: true});
        assert.strictEqual(result, true);
    });       
    it('latest overlay data wins', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a", {a: false}, {a: true});
        assert.strictEqual(result, true);
    });       
});
