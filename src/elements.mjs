import { Template } from "./template.mjs"
import { Nodes, LightSlots } from "./dom.mjs";

class ElementsRegistry {
    #tagToclass = {};
    #idToTemplate = {};
    #id = 0;
    #configured = false;
    #modules;
    #data;
    defineTemplate(html) {
        if (html === null || html === undefined) {
            return undefined;
        }
        const name = `unnamed-${++this.#id}`;
        this.#idToTemplate[name] = Template.fromHtml(html);
        return name;
    }
    define(tag, klass) {
        if (!this.#configured) {
            this.#tagToclass[tag] = klass;
            return this;
        }
        customElements.define(tag, klass);
        return this;
    }
    configure(modules, ...data) {
        this.#modules = modules;
        this.#data = data;
        for (const [tag, klass] of Object.entries(this.#tagToclass)) {
            customElements.define(tag, klass);
            delete this.#tagToclass[tag];
        }
        this.#configured = true;
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
}

const elements = new ElementsRegistry();


class UpgradeQueue {
    #q = [];
    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.#dequeue());
    }
    /**
     * 
     * @param {{upgrade: function}} el 
     */
    enqueue(el) {
        if (!this.#q.length) {
            requestAnimationFrame(() => this.#dequeue());
        }
        this.#q.push(el);
    }
    #dequeue() {
        for (const el of this.#q.splice(0)) {
            el.upgrade()
        }
    }
}

const mappers = {
    'string': attr => attr,
    'number': attr => attr === null ? null : Number(attr),
    'presence': attr => attr !== null,
    'bool': attr => attr === 'true',
    'json': attr => attr === null ? null : JSON.parse(attr)
};

const ParsedElement = (conf) => {
    const upgrades = globalThis.upgrades ??= new UpgradeQueue();

    const { observed, template, templates, slots } = conf ?? {};

    const attrsAndTypes = (observed ?? []).map(a => {
        const [attr, maybeType] = a.split(":");
        const type = maybeType?.trim() ?? 'string';
        if (!(type in mappers)) {
            throw new Error(`unsupported attribute type: ${type}`);
        }
        return [attr.trim(), type];
    });

    const attrsAndMappers = attrsAndTypes.map(([attr, type]) => [attr, mappers[type]]);
    const attrToMapper = Object.fromEntries(attrsAndMappers);

    const templateNamesAndIds = Object.entries(Object.assign({}, templates, { default: template }) ?? {}).map(([k, v]) => [k, elements.defineTemplate(v)]);
    const templateNameToId = Object.fromEntries(templateNamesAndIds);

    const k = class extends HTMLElement {
        static get observedAttributes() {
            return Object.keys(attrToMapper);
        }
        #parsed = false;
        #reflecting = false;
        constructor() {
            super();
        }
        template(name) {
            return elements.template(templateNameToId[name ?? 'default']);
        }
        connectedCallback() {
            if (this.#parsed) {
                return;
            }
            if (this.ownerDocument.readyState === 'complete' || Nodes.isParsed(this)) {
                upgrades.enqueue(this);
                return;
            }
            const ac = new AbortController();
            const clearAndQueue = () => { ac.abort(); observer.disconnect(); upgrades.enqueue(this); }
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
            const mapper = attrToMapper[attr];
            this[attr] = mapper(newValue);
        }
        reflect(fn) {
            this.#reflecting = true;
            try {
                fn();
            } finally {
                this.#reflecting = false;
            }
        }
        async upgrade() {
            if (this.#parsed) {
                return;
            }
            this.#parsed = true;
            // @ts-ignore
            await this.render?.({
                slots: slots ? LightSlots.from(this) : undefined,
                observed: Object.fromEntries(attrsAndMappers.map(([attribute, mapper]) => [attribute, mapper(this.getAttribute(attribute))])),
            });

            for (const [attr, mapper] of attrsAndMappers) {
                if (this.hasAttribute(attr)) {
                    this[attr] = mapper(this.getAttribute(attr));
                }
            }
        }
    };
    return k;
}

export { ElementsRegistry, elements, ParsedElement };
