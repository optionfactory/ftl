
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
            const lastRealElement = (el instanceof DocumentFragment) ? el.lastChild : el;
            root.parentNode.insertBefore(el, predecessor);
            predecessor = lastRealElement.nextSibling;
        }
    }
};


export { dom };

