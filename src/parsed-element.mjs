import { LightSlots } from "./dom.mjs";
import { registry } from "./registry.mjs";

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
        let t = this.#bits().TEMPLATES[name ?? 'default'].withData(data).withModules(modules);
        for (let k of ['l10n', 'config']) {
            const v = this.constructor[k];
            if (v) {
                t = t.withOverlay({ [k]: v });
            }
        }
        return t;
    }
    connectedCallback() {
        if (this.#parsed) {
            return;
        }
        this.#bits().enqueue(this);
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


export { ParsedElement };
