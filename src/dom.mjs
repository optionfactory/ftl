
const dom = {
    fragmentFromNodes(cloneNodes, ...nodes){
        const fragment = new DocumentFragment();
        for(let i=0; i !== nodes.length ;++i){
            const child = nodes[i];
            fragment.appendChild(cloneNodes ? child.cloneNode(true) : child);
        }
        return fragment;
    },
    fragmentFromHtml(...html) {
        const el = document.createElement('div');
        el.innerHTML = html.join("");
        return dom.fragmentFromNodes(false, ...el.childNodes);
    },
    html(...nodes) {
        var r = document.createElement("root");
        r.appendChild(dom.fragmentFromNodes(true, ...nodes));
        return r.innerHTML;
    },
    addSuccessors(root, successors){
        const els = Array.from(successors);
        let predecessor = root.nextSibling;
        for (let i = 0; i !== els.length; ++i) {            
            const el = els[i];
            root.parentNode.insertBefore(el, predecessor);
            predecessor = el.nextSibling;
        }
    },
    meta(name) {
        const node = document.querySelector(`meta[name='${name}']`);
        return node === null ? null : node.getAttribute("content");
    },
    context() {
        return dom.meta("context") || "/";
    },
    lang(defaultValue) {
        const r = document.documentElement.getAttribute("lang") || defaultValue || 'it';
        return r.toLowerCase();
    }
};


export { dom };

