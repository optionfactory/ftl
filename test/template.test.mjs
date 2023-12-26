import {EvaluationContext, Template } from "../dist/ftl.mjs";
import {mockdom} from "./mockdom.mjs"
import { strict as assert } from 'node:assert';
import { mock, test, it, describe } from 'node:test'; 


function toHtml(node) {
    var r = document.createElement("root");
    r.appendChild(node);
    return r.innerHTML;
}

describe('Template', () => {
    const ec = EvaluationContext.configure({
        math: {
            isEven: v => v % 2 === 0
        }
    });

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
    it('rendering null html from attribute yields empty string', () => {
        let data = {a: null};
        let template = Template.fromHtml('<div data-tpl-html="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div></div>');
    });
    it('rendering undefined html from attribute yields empty string', () => {
        let data = {a: undefined};
        let template = Template.fromHtml('<div data-tpl-html="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div></div>');
    });

    it('can render text from attribute', () => {
        let data = {a: '<h1>test</h1>'};
        let template = Template.fromHtml('<div data-tpl-text="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>&lt;h1&gt;test&lt;/h1&gt;</div>');
    });
    it('rendering null text from attribute yields empty string', () => {
        let data = {a: null};
        let template = Template.fromHtml('<div data-tpl-text="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div></div>');
    });
    it('rendering undefined text from attribute yield empty string', () => {
        let data = {a: undefined};
        let template = Template.fromHtml('<div data-tpl-text="a">nope</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div></div>');
    });        
    it('can render text from a text node', () => {
        let data = {a: "<>"};
        let template = Template.fromHtml("<div>b{{a}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>b&lt;&gt;d</div>');
    });
    it('rendering null text from a text node yield empty string', () => {
        let data = {a: null};
        let template = Template.fromHtml("<div>b{{a}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>bd</div>');
    });    
    it('rendering undefined text from a text node yield empty string', () => {
        let data = {a: undefined};
        let template = Template.fromHtml("<div>b{{a}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>bd</div>');
    });      
    it('can render html from a text node', () => {
        let data = {a: "<span></span>"};
        let template = Template.fromHtml("<div>b{{{a}}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>b<span></span>d</div>');
    });
    it('rendering null text from a text node yield empty string', () => {
        let data = {a: null};
        let template = Template.fromHtml("<div>b{{{a}}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>bd</div>');
    });    
    it('rendering undefined text from a text node yield empty string', () => {
        let data = {a: undefined};
        let template = Template.fromHtml("<div>b{{{a}}}d</div>", ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>bd</div>');
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
    it('removing tag does not cause double evaluation', () => {
        let data = {a: "{{'1'}}"};
        let template = Template.fromHtml('<div data-tpl-remove="tag">{{a}}</div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), "{{'1'}}");
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
        let template = Template.fromHtml('<div data-tpl-each="self"><span data-tpl-if="#math:isEven(self)">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div></div><div><span>2</span></div><div></div><div><span>4</span></div>');
    });
    it('can evaluate nested tags (each -> if) removing tags', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-each="self" data-tpl-remove="tag"><span data-tpl-if="#math:isEven(self)" data-tpl-remove="tag">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '24');
    });
    it('can evaluate nested tags (if -> each)', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-if="#math:isEven(2)"><span data-tpl-each="self">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div><span>1</span><span>2</span><span>3</span><span>4</span></div>');
    });
    it('can evaluate nested tags (if -> each) removing tags', () => {
        let data = [1, 2, 3, 4];
        let template = Template.fromHtml('<div data-tpl-if="#math:isEven(2)" data-tpl-remove="tag"><span data-tpl-each="self" data-tpl-remove="tag">{{ self }}</span></div>', ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '1234');
    });
    it('inner text node is not reevaluated when generated by tpl-text', () => {
        let data = {a: 1};
        let template = Template.fromHtml(`<div data-tpl-text="'{{a}}'"></div>`, ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>{{a}}</div>');
    });
    it('inner html node is not reevaluated when generated by tpl-html', () => {
        let data = {a: 1};
        let template = Template.fromHtml(`<div data-tpl-html="'{{a}}'"></div>`, ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), '<div>{{a}}</div>');
    });    
    it('inner nodes are not reevaluated when generated by tpl-each', () => {
        let data = [`{{'1'}}`,`{{'2'}}`];
        let template = Template.fromHtml(`<div data-tpl-each="self">{{self}}</div>`, ec);
        let rendered = template.render(data);
        assert.strictEqual(toHtml(rendered), `<div>{{'1'}}</div><div>{{'2'}}</div>`);
    });    
    it('can show error', () => {
        let data = [1, 2];
        let template = Template.fromHtml(`<div id="container">
                    <span>something ignored</span>
                    <div data-tpl-each="self">{{self.boom()}}</div>
                </div>`
            , ec);
        try {
            template.render(data)
        } catch (ex) {
            const expected = 'Method missing "boom"\n'
                + '\t--> {{self.boom()}}\n'
                + '\t--> <div>{{self.boom()}}</div>\n'
                + '\t--> <div data-tpl-each="self"></div>';
            assert.strictEqual(ex.message, expected);

        }
    });

});
