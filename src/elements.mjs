import { Template } from "./template.mjs"
import { Nodes, LightSlots } from "./dom.mjs";


class UpgradeQueue {
    #q = new Map();
    tracer; 
    constructor(trace) {
        document.addEventListener('DOMContentLoaded', () => this.#dequeue("dcl"));
    }
    enqueue(el) {
        this.tracer?.("enqueued", el);
        if(this.#q.has(el)){
            //already upgrading, can happen when disconnecting an element
            //while it's already queued for upgrade (e.g.: ful-form)
            this.tracer?.("spurious enqueue on:", el);
            return;
        }
        if (this.#q.size === 0) {
            this.tracer?.("first in queue. scheduling #dequeue");
            //first in queue schedules the dequeing
            requestAnimationFrame(() => this.#dequeue("raf"));
        }
        let resolve;
        const promise = new Promise((res, rej) => {
            resolve = res;
        }).then(() => el.upgrade());
        this.#q.set(el, { promise, resolve });
    }
    async waitForChildrenRendered(el) {
        const pending = Array.from(this.#q.entries())
            .filter(([child, { promise }]) => el !== child && el.contains(child))
            .map(([child, { promise }]) => promise);
        await Promise.all(pending);
    }
    #dequeue(source) {
        this.tracer?.("dequeuing", this.#q.size, "elements from", source, ":", this.#q);
        for (const [el, { resolve }] of this.#q) {
            this.#q.delete(el);
            resolve();
        }
    }
}

class Registry {
    #tagToClass = {};
    #idToTemplate = {};
    #id = 0;
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
    #upgrades = new UpgradeQueue();
    defineTemplate(id, html) {
        if (html === null || html === undefined) {
            return undefined;
        }
        const tid = id ?? `unnamed-${++this.#id}`;
        this.#idToTemplate[tid] = Template.fromHtml(html);
        return tid;
    }
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

        const templateNamesAndIds = Object.entries(Object.assign({}, templates, { default: template }) ?? {}).map(([k, v]) => [k, registry.defineTemplate(null, v)]);
        const templateNameToId = Object.fromEntries(templateNamesAndIds);

        klass.BITS = {
            enqueue: (el) => this.#upgrades.enqueue(el),
            SLOTS: slots,
            ATTR_TO_MAPPER: attrToMapper,
            ATTRS_AND_MAPPERS: attrsAndMappers,
            TEMPLATE_NAME_TO_ID: templateNameToId
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
    trace(){
        const tracer = (...args) => {
            console.log("tracing", ...args);
        }
        this.#upgrades.tracer = tracer;
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
    template(k) {
        if (k === null || k === undefined) {
            return undefined;
        }
        if (!this.#configured) {
            throw new Error("ElementsRegistry is not configured");
        }
        const template = this.#idToTemplate[k];
        if (!template) {
            throw new Error(`missing template: '${k}'`);
        }
        return template.withData(this.#data).withModules(this.#modules);
    }
    async waitForChildrenRendered(el) {
        await this.#upgrades.waitForChildrenRendered(el);
    }
    context() {
        return {
            modules: this.#modules,
            dataStack: this.#data
        }
    }
    component(name) {
        return this.#components[name];
    }
}

const registry = new Registry();

class ParsedElement extends HTMLElement {
    static BITS = {
        enqueue: (el) => { },
        SLOTS: false,
        ATTR_TO_MAPPER: {},
        ATTR_AND_MAPPERS: [],
        TEMPLATE_NAME_TO_ID: {}
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
        return registry.template(this.#bits().TEMPLATE_NAME_TO_ID[name ?? 'default']);
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


export { Registry, registry, ParsedElement };
