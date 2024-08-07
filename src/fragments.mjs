/* global DocumentFragment, HTMLTemplateElement */

class Fragments {
    /**
     * 
     * @param  {string} html 
     * @returns 
     */
    static fromHtml(html) {
        const el = document.createElement("template");
        el.innerHTML = html;
        return el.content;
    }    
}


export { Fragments };

