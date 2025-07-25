import { Nodes } from "./dom.mjs";
import { Template } from "./template.mjs";

class UpgradeQueue {
    #q = new Map();
    #scheduled = false;
    constructor() {
        document.addEventListener('DOMContentLoaded', async () => {
            const pending = Array.from(this.entries).map(([child, { promise, resolve }]) => promise);
            await Promise.all(pending);
            document.dispatchEvent(new CustomEvent('ftl:ready', {
                bubbles: false,
                cancelable: false,
            }));
        });
    }
    enqueue(el) {
        if (this.#q.has(el)) {
            //already upgrading, can happen when disconnecting an element
            //while it's already queued for upgrade (e.g.: ful-form)
            return;
        }
        if (!this.#scheduled) {
            //first in queue schedules the dequeing
            this.#scheduled = true;
            requestAnimationFrame(() => this.#dequeue("raf"));
        }
        let resolve;
        const promise = new Promise((res) => { resolve = res; })
            .then(() => Nodes.waitParsed(el))
            .then(() => el.upgrade())
            .finally(() => this.#q.delete(el));
        this.#q.set(el, { promise, resolve });
    }
    #dequeue(source) {
        this.#scheduled = false;
        for (const [el, { resolve }] of this.#q) {
            resolve();
        }
    }
    get entries() {
        return this.#q.entries();
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


export { Registry, registry }