const nodes = {
    ter: Symbol("tenary"),
    nullc: Symbol("null-coalescion"),
    or: Symbol("or"),
    and: Symbol("and"),
    eq: Symbol("eq"),
    cmp: Symbol("cmp"),
    not: Symbol("not"),
    access: Symbol("access"),
    member: Symbol("access-member"),
    subscript: Symbol("access-subscript"),
    method: Symbol("access-method-call"),
    call: Symbol("module-function-call"),
    literal: Symbol("literal"),
    array: Symbol("array-literal"),
    dict: Symbol("dict-literal"),
    function: Symbol("module-function"),
    symbol: Symbol("symbol"),
    templated: {
        ten: Symbol("templeted-node"),
        teh: Symbol("templated-html"),
        tet: Symbol("templated-text"),
        tel: Symbol("templated-literal"),
    },
    dom: {
        t: Symbol("text"),
        h: Symbol("html"),
        n: Symbol("node")
    }

}


export { nodes };