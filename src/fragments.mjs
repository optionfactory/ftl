/* global DocumentFragment, HTMLTemplateElement */

class Fragments {
    static fromHtml(html) {
        const el = document.createElement('div');
        el.innerHTML = html;
        const fragment = new DocumentFragment();
        fragment.append(...el.childNodes);
        return fragment;
    }
}


export { Fragments };

