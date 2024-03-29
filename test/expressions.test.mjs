import {ExpressionEvaluator} from "../dist/ftl.mjs";


import { strict as assert } from 'node:assert';
import { mock, test, it, describe } from 'node:test'; 

let evaluator = new ExpressionEvaluator({
    one: () => 1,
    math: {
        isEven: (v) => v % 2 === 0
    }
});

function verify(description, expr, data, expected){
    it(description ||`${expr} == ${expected}`, () => {
        assert.deepStrictEqual(evaluator.evaluate(expr, data), expected);
    })
}

describe('Expression', () => {
    verify('can use member access', "a.b.c", {a: {b: {c: 1}}}, 1);
    verify('can use nullsafe member access', "a?.b.c", {}, undefined);    
    verify('can call a method', "a.toLowerCase()", {a: "M"}, "m");
    verify('can navigate array', "a['b']", {a: {b: "M"}}, "M");
    verify('can navigate array', "a?.['b']", {a: null}, undefined);
    verify('can call function from data', "a()", {a: () => "M"}, "M");
    verify('can evaluate ternary operator', "a ? b : c", {a: false, b: "lhs", c: "rhs"}, "rhs");
    verify('can evaluate eq', "a == b", {a: 1, b: 1}, true);
    verify('can evaluate neq', "a != b", {a: 1, b: 1}, false);
    verify('can evaluate gt', "a > b", {a: 2, b: 1}, true);
    verify('can evaluate gte', "a >= b", {a: 1, b: 1}, true);
    verify('can evaluate lt', "a < b", {a: 1, b: 2}, true);
    verify('can evaluate lte', "a <= b", {a: 1, b: 1}, true);
    verify('can evaluate not', "!a", {a: true}, false);
    verify('can evaluate boolean literal (true)', "true", {}, true);
    verify('can evaluate boolean literal (false)', "false", {}, false);
    verify('can evaluate self', "self", "someValue", "someValue");
    verify('can call a function', "#one()", {}, 1)
    verify('can call a function in module', "#math:isEven(2)", {}, true)
    verify("can evaluate multiple !", "!!!!!!!!!!!a", {a: true}, false);
    verify("can use dict literal", "{'a': true, 'b': false}", {}, {a: true, b: false});
    verify("can use array literal", "[1,2]", {}, [1,2]);
    verify("can use string literal", '"abc"', {}, "abc");
    verify("can use string literal", "'abc'", {}, "abc");
    verify("can use number literal", "12.3", {}, 12.3);
    verify(null, "(!a && !b) == !(a || b)", {a: true, b: false}, true);
    verify(null, "!a && !b == !(a || b)", {a: true, b: false}, false);
    verify(null, "a.b[c.d].toLowerCase()", {a: {b : { z: "M"}}, c: {d : "z"}}, "m");
    verify(null, "[1,2][1]", {}, 2);


    it('can use overlays', () => {
        let result = evaluator.evaluate("a", {}, {a: true});
        assert.strictEqual(result, true);
    });

    it('latest overlay data wins', () => {
        let result = evaluator.evaluate("a", {a: false}, {a: true});
        assert.strictEqual(result, true);
    });

    it('can report error on method calls', () => {
        try {
            evaluator.evaluate("a.boom()", {a: false});
        } catch (ex) {
            assert.strictEqual(ex.message, 'Method missing "boom"');
        }
    });

    it('can report error on missing module', () => {
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
