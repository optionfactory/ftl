import "./mock-dom.mjs";
import { Expressions } from "../dist/ftl.mjs";
import { strict as assert } from 'node:assert';
import { it, describe } from 'node:test';


const modules = {
    one: () => 1,
    math: {
        isEven: (v) => v % 2 === 0
    },
    accessData: function() {
        return this.a;
    }
};

const verify = (description, expr, data, expected) => {
    it(description || `${expr} == ${expected}`, () => {
        assert.deepStrictEqual(Expressions.interpret(modules, data, expr), expected);
    })
}

describe('Expression', () => {
    verify('can use member access', "a.b.c", [{ a: { b: { c: 1 } } }], 1);
    verify('can use nullsafe member access', "a?.b.c", [{}], undefined);
    verify('can call a method', "a.toLowerCase()", [{ a: "M" }], "m");
    verify('can navigate array', "a['b']", [{ a: { b: "M" } }], "M");
    verify('can navigate array', "a?.['b']", [{ a: null }], undefined);
    verify('can call function from data', "a()", [{ a: () => "M" }], "M");
    verify('can evaluate ternary operator', "a ? b : c", [{ a: false, b: "lhs", c: "rhs" }], "rhs");
    verify('can evaluate ternary operator', "a ?: c", [{ a: false, b: "lhs", c: "rhs" }], "rhs");
    verify('can evaluate ternary operator', "a ?: b", [{ a: 'lhs', b: "rhs" }], "lhs");
    verify('can evaluate ??', "a ?? b", [{ a: "rhs", b: "lhs" }], "rhs");
    verify('can evaluate ??', "a ?? b", [{ a: undefined, b: "lhs" }], "lhs");
    verify('can evaluate ??', "a ?? b", [{ a: null, b: "lhs" }], "lhs");
    verify('can evaluate ??', "a ?? b", [{ a: false, b: "rhs" }], false);
    verify('can evaluate eq', "a == b", [{ a: 1, b: 1 }], true);
    verify('can evaluate neq', "a != b", [{ a: 1, b: 1 }], false);
    verify('can evaluate gt', "a > b", [{ a: 2, b: 1 }], true);
    verify('can evaluate gte', "a >= b", [{ a: 1, b: 1 }], true);
    verify('can evaluate lt', "a < b", [{ a: 1, b: 2 }], true);
    verify('can evaluate lte', "a <= b", [{ a: 1, b: 1 }], true);
    verify('can evaluate not', "!a", [{ a: true }], false);
    verify('can evaluate boolean literal (true)', "true", [], true);
    verify('can evaluate boolean literal (false)', "false", [], false);
    verify('can evaluate self', "self", ["someValue"], "someValue");
    verify('can call a function', "#one()", [], 1)
    verify('can call a function in module', "#math:isEven(2)", [], true)
    verify('can reference data using this in a module function', "#accessData()", [{a:1}, {a:2}], 2)
    verify("can evaluate multiple !", "!!!!!!!!!!!a", [{ a: true }], false);
    verify("can use dict literal", "{'a': true, 'b': false}", [{}], { a: true, b: false });
    verify("can use array literal", "[1,2]", [{}], [1, 2]);
    verify("can use string literal", '"abc"', [{}], "abc");
    verify("can use string literal", "'abc'", [{}], "abc");
    verify("can use number literal", "12.3", [{}], 12.3);
    verify(null, "(!a && !b) == !(a || b)", [{ a: true, b: false }], true);
    verify(null, "!a && !b == !(a || b)", [{ a: true, b: false }], false);
    verify(null, "a.b[c.d].toLowerCase()", [{ a: { b: { z: "M" } }, c: { d: "z" } }], "m");
    verify(null, "[1,2][1]", {}, 2);


    it('can use overlays', () => {
        let result = Expressions.interpret(modules, [{}, { a: true }], "a");
        assert.strictEqual(result, true);
    });

    it('latest overlay data wins', () => {
        let result = Expressions.interpret({}, [{ a: false }, { a: true }], "a");
        assert.strictEqual(result, true);
    });

    it('can report error on method calls', () => {
        try {
            Expressions.interpret({}, [{ a: false }], "a.boom()");
        } catch (ex) {
            assert.strictEqual(ex.message, 'Method missing "boom"');
        }
    });

    it('can report error on missing module', () => {
        try {
            Expressions.interpret({}, [], "#waldo:boom()");
        } catch (ex) {
            assert.strictEqual(ex.message, 'Module "waldo" not found');
        }
    });
    it('can report error on missing module', () => {
        try {
            Expressions.interpret({ waldo: {}}, [],  "#waldo:isHidden()");
        } catch (ex) {
            assert.strictEqual(ex.message, 'Function "#waldo:isHidden" not found');
        }
    });


});
