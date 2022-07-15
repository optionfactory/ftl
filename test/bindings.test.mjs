import { Bindings } from "../src/bindings.mjs";
import { dom  } from "../src/dom.mjs"
import { mockdom } from "./mockdom.mjs"

import assert from 'assert';

const fragment = dom.fragmentFromHtml;


describe('Bindings', () => {
    mockdom('');
    it('can extract value from an input text', () => {
        const bindings = new Bindings({});
        const el = fragment('<input type="text" name="a" value="1">');
        const got = bindings.values(el);
        assert.deepEqual(got, {a: "1"});
    });
    it('can extract value from a select', () => {
        let bindings = new Bindings({});
        const el = fragment('<select name="a"><option value="nope">NO</option><option value="1" selected="selected">YES</option></select>');
        const got = bindings.values(el);
        assert.deepEqual(got, {a: "1"});
    });
    it('can extract value from an unchecked checkbox', () => {
        let bindings = new Bindings({});
        const el = fragment('<input type="checkbox" name="a">');
        const got = bindings.values(el);
        assert.deepEqual(got, {a: false});
    });
    it('can extract value from an checked checkbox', () => {
        let bindings = new Bindings({});
        const el = fragment('<input type="checkbox" name="a" checked>');
        const got = bindings.values(el);
        assert.deepEqual(got, {a: true});
    });
    it('can extract value from an checked radio button', () => {
        let bindings = new Bindings({});
        const el = fragment(
            '<input type="radio" name="a" value="1">',
            '<input type="radio" name="a" value="2" checked="checked">',
            '<input type="radio" name="a" value="3">',
        );
        const got = bindings.values(el);
        assert.deepEqual(got, {a: 2});
    });
    it('can extract deeply nested values', () => {
        let bindings = new Bindings({});
        const el = fragment('<input type="checkbox" name="a.b.c" checked>');
        const got = bindings.values(el);
        assert.deepEqual(got, {a: {b: {c: true}}});
    });
    it('can extract all values from a container', () => {
        let bindings = new Bindings({});
        const el = fragment(
            '<form>',
            ' <input type="checkbox" name="a.a" checked>',
            ' <input type="checkbox" name="a.b" checked>',
            ' <input type="text" name="a.c" value="lorem ipsum">',
            '</form>'
        );
        const got = bindings.values(el);
        assert.deepEqual(got, {a: {a: true, b: true, c: "lorem ipsum"}});
    });
    it('tags with [data-bind-include=never] are ignored', () => {
        let bindings = new Bindings({});
        const el = fragment(
            '<form>',
            ' <input type="checkbox" name="a.a" checked data-bind-include="never">',
            '</form>'
        );
        const got = bindings.values(el);
        assert.deepEqual(got, {});
    });
    it('tags children of an ignoreChildrenSelector are ignored', () => {
        let bindings = new Bindings({
            ignoredChildrenSelector: '.hide'
        });
        const el = fragment(
            '<form class="hide">',
            ' <input type="checkbox" name="a.a" checked>',
            '</form>'
        );
        const got = bindings.values(el);
        assert.deepEqual(got, {});
    });    
    it('tags with [data-bind-include=always] children of an ignoreChildrenSelector are not ignored', () => {
        let bindings = new Bindings({
            ignoredChildrenSelector: '.hide'
        });
        const el = fragment(
            '<form class="hide">',
            ' <input type="checkbox" name="a.a" checked data-bind-include="always">',
            '</form>'
        );
        const got = bindings.values(el);
        assert.deepEqual(got, {a: {a: 1}});
    });        
});