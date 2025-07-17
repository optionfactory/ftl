import { Template } from "./template.mjs"
import { Nodes, LightSlots } from "./dom.mjs";


class UpgradeQueue {
    #q = new Map();
    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.#dequeue("dcl"));
    }
    enqueue(el) {
        if (this.#q.has(el)) {
            //already upgrading, can happen when disconnecting an element
            //while it's already queued for upgrade (e.g.: ful-form)
            return;
        }
        if (this.#q.size === 0) {
            //first in queue schedules the dequeing
            requestAnimationFrame(() => this.#dequeue("raf"));
        }
        let resolve;
        const promise = new Promise((res, rej) => {
            resolve = res;
        }).then(() => el.upgrade());
        this.#q.set(el, { promise, resolve });
    }
    get entries() {
        return this.#q.entries();
    }
    #dequeue(source) {
        for (const [el, { resolve }] of this.#q) {
            this.#q.delete(el);
            resolve();
        }
    }
}

class Registry {
    #tagToClass = {};
    #configured = false;
    #mappers = {
        'string': attr => attr,
        'number': attr => attr === null ? null : Number(attr),
        'presence': attr => attr !== null,
        'bool': attr => attr === 'true',
        'json': attr => attr === null ? null : JSON.parse(attr),
        'csv': attr => attr === null ? [] : attr.split(",").map(e => e.trim()).filter(e => e)
    };
    #components = {};
    #modules;
    #data = [];
    #upgradeQueue = new UpgradeQueue();
    defineElement(tag, klass) {
        if (!this.#configured) {
            this.#tagToClass[tag] = klass;
            return this;
        }
        this.#augmentAndDefineElement(tag, klass);
        return this;
    }
    #augmentAndDefineElement(tag, klass) {
        const { observed, template, templates, slots, mappers } = klass;
        const attrsAndTypes = (observed ?? []).map(a => {
            const [attr, maybeType] = a.split(":");
            const type = maybeType?.trim() ?? 'string';
            if (!(type in this.#mappers) && !(type in (mappers ?? {}))) {
                throw new Error(`unsupported attribute type: ${type}`);
            }
            return [attr.trim(), type];
        });

        const attrsAndMappers = attrsAndTypes.map(([attr, type]) => [attr, mappers?.[type] ?? this.#mappers[type]]);
        const attrToMapper = Object.fromEntries(attrsAndMappers);

        const namesAndTemplates = Object.entries(Object.assign({}, templates, { default: template }) ?? {}).map(([k, v]) => [k, Template.fromHtml(v)]);
        const nameToTemplate = Object.fromEntries(namesAndTemplates);

        klass.BITS = {
            enqueue: (el) => this.#upgradeQueue.enqueue(el),
            SLOTS: slots,
            ATTR_TO_MAPPER: attrToMapper,
            ATTRS_AND_MAPPERS: attrsAndMappers,
            TEMPLATES: nameToTemplate
        }
        customElements.define(tag, klass);
    }
    defineModule(name, value) {
        const module = name ? { [name]: value } : value;
        this.#modules = { ...this.#modules, ...module };
        return this;
    }
    defineModules(ms) {
        this.#modules = ms;
        return this;
    }
    defineComponent(name, value) {
        this.#components[name] = value;
        return this;
    }
    defineData(...data) {
        this.#data = data;
        return this;
    }
    defineOverlay(...data) {
        this.#data = [...this.#data, ...data];
        return this;
    }
    defineMapper(k, v) {
        this.#mappers[k] = v;
        return this;
    }
    plugin(p) {
        p.configure(this);
        return this;
    }
    configure() {
        for (const [tag, klass] of Object.entries(this.#tagToClass)) {
            this.#augmentAndDefineElement(tag, klass);
            delete this.#tagToClass[tag];
        }
        this.#configured = true;
        return this;
    }
    get upgrades() {
        return this.#upgradeQueue.entries;
    }
    context() {
        return { modules: this.#modules, data: this.#data };
    }
    component(name) {
        return this.#components[name];
    }
}

const registry = new Registry();

class Templates {
    static templateFromHtml(html) {
        const { modules, data } = registry.context()
        return Template.fromHtml(html, modules, ...data);
    }
    static templateFromSelector(selector) {
        const { modules, data } = registry.context()
        return Template.fromHtml(selector, modules, ...data);
    }
    static templateFromTemplate(templateEl) {
        const { modules, data } = registry.context()
        return Template.fromTemplate(templateEl, modules, ...data);
    }
    static templateFromFragment(fragment) {
        const { modules, data } = registry.context()
        return Template.fromFragment(fragment, modules, ...data);
    }
}

class Rendering {
    static async waitFor(el) {
        const pending = Array.from(registry.upgrades)
            .filter(([child, { promise }]) => el.contains(child))
            .map(([child, { promise }]) => promise);
        await Promise.all(pending);
    }
    static async waitForChildren(el) {
        const pending = Array.from(registry.upgrades)
            .filter(([child, { promise }]) => el !== child && el.contains(child))
            .map(([child, { promise }]) => promise);
        await Promise.all(pending);
    }

}

class ParsedElement extends HTMLElement {
    static BITS = {
        enqueue: (el) => { },
        SLOTS: false,
        ATTR_TO_MAPPER: {},
        /** @type [string, Function][] */
        ATTRS_AND_MAPPERS: [],
        TEMPLATES: {}
    }
    static get observedAttributes() {
        return Object.keys(this.BITS.ATTR_TO_MAPPER);
    }
    #parsed = false;
    #reflecting = false;
    #bits() {
        return /** @type {typeof ParsedElement} */(this.constructor).BITS;
    }
    template(name) {
        const { modules, data } = registry.context();
        return this.#bits().TEMPLATES[name ?? 'default'].withData(data).withModules(modules);
    }
    connectedCallback() {
        if (this.#parsed) {
            return;
        }
        if (this.ownerDocument.readyState === 'complete' || Nodes.isParsed(this)) {
            this.#bits().enqueue(this);
            return;
        }
        const ac = new AbortController();
        const clearAndQueue = () => { ac.abort(); observer.disconnect(); this.#bits().enqueue(this); }
        this.ownerDocument.addEventListener('DOMContentLoaded', clearAndQueue, { signal: ac.signal });
        const observer = new MutationObserver(() => {
            if (!Nodes.isParsed(this)) {
                return;
            }
            clearAndQueue();
        });
        const parent = /** @type {Node} */ (this.parentNode);
        observer.observe(parent, { childList: true });
    }
    attributeChangedCallback(attr, oldValue, newValue) {
        if (!this.#parsed || oldValue === newValue) {
            return;
        }
        if (this.#reflecting) {
            return;
        }
        const mapper = this.#bits().ATTR_TO_MAPPER[attr];
        this[attr] = mapper(newValue, attr, this);
    }
    #disabledBeforeParsed = null;
    formDisabledCallback(disabled) {
        if (!this.#parsed) {
            this.#disabledBeforeParsed = disabled;
            return;
        }
        this.disabled = disabled;
    }
    async upgrade() {
        if (this.#parsed) {
            return;
        }
        this.#parsed = true;
        const slots = this.#bits().SLOTS ? LightSlots.from(this) : undefined;
        const observed = Object.fromEntries(this.#bits().ATTRS_AND_MAPPERS.map(([attribute, mapper]) => [attribute, mapper(this.getAttribute(attribute), attribute, this)]));
        const disabled = this.#disabledBeforeParsed ?? false
        await this.render({ slots, observed, disabled });
    }
    render(c) {
    }
    reflect(fn) {
        this.#reflecting = true;
        try {
            fn();
        } finally {
            this.#reflecting = false;
        }
    }
}


export { Registry, registry, Templates, Rendering, ParsedElement };
