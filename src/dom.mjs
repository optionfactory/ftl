/* global DocumentFragment, HTMLTemplateElement */

const dom = {
    fragmentFromNodes(cloneNodes, flattenTemplates, ...nodes) {
        const fragment = new DocumentFragment();
        for (let i = 0; i !== nodes.length; ++i) {
            const child = nodes[i];
            const flattened = flattenTemplates && (child instanceof HTMLTemplateElement) ? child.content : child;
            fragment.appendChild(cloneNodes ? flattened.cloneNode(true) : child);
        }
        return fragment;
    },
    fragmentFromHtml(...html) {
        const el = document.createElement('div');
        el.innerHTML = html.join("");
        return dom.fragmentFromNodes(false, false, ...el.childNodes);
    },
    html(...nodes) {
        var r = document.createElement("root");
        r.appendChild(dom.fragmentFromNodes(true, false, ...nodes));
        return r.innerHTML;
    },
    addPredecessors(root, predecessors) {
        const els = Array.from(predecessors);
        for (let i = 0; i !== els.length; ++i) {
            root.parentNode.insertBefore(els[i], root);
        }
    },    
    addSuccessors(root, successors) {
        const els = Array.from(successors);
        let predecessor = root.nextSibling;
        for (let i = 0; i !== els.length; ++i) {
            const el = els[i];
            const lastRealElement = (el instanceof DocumentFragment) ? el.lastChild : el;
            root.parentNode.insertBefore(el, predecessor);
            predecessor = lastRealElement?.nextSibling;
        }
    }
};


export { dom };

