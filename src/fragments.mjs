class Fragments {
    /**
     * 
     * @param  {string} html 
     * @returns {DocumentFragment} the document fragment
     */
    static fromHtml(html) {
        const el = document.createElement("template");
        el.innerHTML = html;
        return document.adoptNode(el.content);
    }    
}


export { Fragments };

