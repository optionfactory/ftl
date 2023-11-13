import {ExpressionEvaluator} from "../dist/ftl.mjs";

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
    it('can evaluate a ternary operator', () => {
        let evaluator = new ExpressionEvaluator();
        let result = evaluator.evaluate("a ? b : c", {a: false, b: "B_VALUE", c: "C_VALUE"});
        assert.strictEqual(result, 'C_VALUE');
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
                isEven: (v) => v % 2 === 0
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

    it('can report error on method calls', () => {
        let evaluator = new ExpressionEvaluator();
        try {
            evaluator.evaluate("a.boom()", {a: false});
        } catch (ex) {
            assert.strictEqual(ex.message, 'Method missing "boom"');
        }
    });

    it('can report error on missing module', () => {
        let evaluator = new ExpressionEvaluator();
        try {
            evaluator.evaluate("#waldo:boom()", {a: false});
        } catch (ex) {
            assert.strictEqual(ex.message, 'Module "waldo" not found');
        }
    });
    it('can report error on missing module', () => {
        let evaluator = new ExpressionEvaluator({
            waldo: {}
        });
        try {
            evaluator.evaluate("#waldo:isHidden()", {a: false});
        } catch (ex) {
            assert.strictEqual(ex.message, 'Function "#waldo:isHidden" not found');
        }
    });

});
