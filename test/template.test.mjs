import { Template, TplCommandsHandler } from "../src/template.mjs";
import { ExpressionEvaluator, TextNodeExpressionEvaluator } from "../src/expressions.mjs";
import { mockdom } from "./mockdom.mjs"
import assert from 'assert';


function toHtml(node) {
    var r = document.createElement("root");
    r.appendChild(node);
    return r.innerHTML;
}

describe('Template', () => {
    const functions = {
        math : {
            isEven: v => v % 2 === 0
        }
    };
    const ee = new ExpressionEvaluator(functions);
    const tnee = new TextNodeExpressionEvaluator(ee);
    const ch = new TplCommandsHandler();
    const ec = {
        evaluator: ee,
        textNodeEvaluator: tnee,
        commandsHandler: ch
    };
    
    mockdom("<html></html>");
    it('can iterate with *-each', () => {
        let data = [1, 2];
        let template = Template.fromHtml('<div data-tpl-each="self">{{self}}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>1</div><div>2</div>');
    });
    it('can skip rendering with *-if', () => {
        let data = {};
        let template = Template.fromHtml('<div data-tpl-if="false">{{v}}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '');
    });
    it('can render with *-if', () => {
        let data = {a: 1};
        let template = Template.fromHtml('<div data-tpl-if="true">{{a}}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>1</div>');
    });
    it('can render html from attribute', () => {
        let data = {a: '<h1>test</h1>'};
        let template = Template.fromHtml('<div data-tpl-html="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div><h1>test</h1></div>');
    });
    it('can render text from attribute', () => {
        let data = {a: '<h1>test</h1>'};
        let template = Template.fromHtml('<div data-tpl-text="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>&lt;h1&gt;test&lt;/h1&gt;</div>');
    });
    it('can render text from a text node', () => {
        let data = {a: "<>"};
        let template = Template.fromHtml("<div>b{{a}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>b&lt;&gt;d</div>');
    });
    it('can evaluate a data-* attribute', () => {
        let data = {a: 1, b: 2};
        let template = Template.fromHtml('<div data-tpl-former="a" data-tpl-latter="b">content</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div former="1" latter="2">content</div>');
    });
    it('can *-remove-tag', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-remove="tag">123</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '123');
    });
    it('can *-remove-tag from *-each', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-each="self" data-tpl-remove="tag">{{ self }}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '1234');
    });
    it('can *-remove-tag from *-if', () => {
        let data = {};
        let template = Template.fromHtml('<div data-tpl-if="true" data-tpl-remove="tag">{{ 1 }}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '1');
    });
    it('can evaluate nested tags (each -> if)', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-each="self" data-tpl-remove="tag"><span data-tpl-remove="tag" data-tpl-if="#math:isEven(self)">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '24');
    });

    it('can evaluate nested tags (if -> each)', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-if="#math:isEven(2)" data-tpl-remove="tag"><span data-tpl-remove="tag" data-tpl-each="self">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '1234');
    });


});
