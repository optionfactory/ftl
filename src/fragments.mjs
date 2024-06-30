/* global DocumentFragment, HTMLTemplateElement */

class Fragments {
    static fromHtml(...html) {
        const el = document.createElement('div');
        el.innerHTML = html.join("");
        const fragment = new DocumentFragment();
        fragment.append(...el.childNodes);
        return fragment;
    }
    static fromNodes(cloneNodes, flattenTemplates, ...nodes) {
        const fragment = new DocumentFragment();
        for (let i = 0; i !== nodes.length; ++i) {
            const child = nodes[i];
            const flattened = flattenTemplates && (child instanceof HTMLTemplateElement) ? child.content : child;
            fragment.appendChild(cloneNodes ? flattened.cloneNode(true) : child);
        }
        return fragment;
    }

}


export { Fragments };

