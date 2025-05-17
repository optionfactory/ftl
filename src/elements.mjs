import { Template } from "./template.mjs"
import { Nodes, LightSlots } from "./dom.mjs";


class UpgradeQueue {
    #q = [];
    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.#dequeue());
    }
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

class ElementsRegistry {
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
        customElements.define(tag, klass);
        return this;
    }
    defineModule(name, value) {
        const module = name ? { [name]: value } : value;
        this.#modules = { ...this.#modules, module };
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
            const { observed, template, templates, slots, mappers } = klass;
        
            const attrsAndTypes = (observed ?? []).map(a => {
                const [attr, maybeType] = a.split(":");
                const type = maybeType?.trim() ?? 'string';
                if (!(type in this.#mappers)) {
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
            delete this.#tagToClass[tag];
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
    component(name) {
        return this.#components[name];
    }
}

const registry = new ElementsRegistry();

class ParsedElement extends HTMLElement {
    static BITS = {
        enqueue: (el) => {},
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
    #bits(){
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
    reflect(fn) {
        this.#reflecting = true;
        try {
            fn();
        } finally {
            this.#reflecting = false;
        }
    }
    render(c){
    }
    async upgrade() {
        if (this.#parsed) {
            return;
        }
        this.#parsed = true;
        await this.render({
            slots: this.#bits().SLOTS ? LightSlots.from(this) : undefined,
            observed: Object.fromEntries(this.#bits().ATTRS_AND_MAPPERS.map(([attribute, mapper]) => [attribute, mapper(this.getAttribute(attribute), attribute, this)])),
        });

        for (const [attr, mapper] of this.#bits().ATTRS_AND_MAPPERS) {
            if (this.hasAttribute(attr)) {
                this[attr] = mapper(this.getAttribute(attr), attr, this);
            }
        }
    }    
}


export { ElementsRegistry, registry, ParsedElement };
