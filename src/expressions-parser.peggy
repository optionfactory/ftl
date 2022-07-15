{{
    function unescape1(v){
    	return v;
    }
    function unescape2(v){
    	return v;
    }
}}

Root = _ r:Expression _ { return r; }

Expression
    = from:NavigationRoot _ to:(@(NavigationCondition / NavigationNullSafe / NavigationDot / NavigationSubscript / NavigationMethod) _)* {
        return to.length === 0 ? from : {type: "nav", from, to};
    }   
NavigationRoot = FunctionCall 
    / AnyLiteral
    / Symbol
    
//TODO subexpression for whentrue and whenfalse using parenthesis for condition
NavigationCondition = "?" _ ifTrue:Expression? _ ":" _ ifFalse:Expression { return {type:"cond", ifTrue, ifFalse}; }
NavigationNullSafe = "?." _ r:Symbol { return {type: "dot", ns: true, value: r.value}; }
NavigationDot = "." _ r:Symbol { return {type: "dot", ns: false, value: r.value}; }
NavigationSubscript "subscript" = op:"?."? "[" _ r:Expression _ "]"  { return {type: "sub", ns: op !== null, value: r}; } 
NavigationMethod "methodCall" = op:"?."? "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" { return {type: "method", ns: op !== null, value: h == null ? [] : [h].concat(t)}; }


FunctionCall "functionCall" = fn:FunctionRef "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" {
    const args = h == null ? [] : [h].concat(t);
    return {type: "call", value: fn, args};
}

AnyLiteral
    = NumberLiteral
    / BooleanLiteral
    / StringLiteral
    / ArrayLiteral
    / DictLiteral
    / StringLiteral

BooleanLiteral "boolean"
    = "true" { return {type: "literal", value: true}; }
    / "false" { return {type: "literal", value: false}; }
NumberLiteral "number" = p:[0-9]+ s:("." @[0-9]*)? { 
    if (s == null){
        return {type: "literal", value: parseInt(p.join(""))};
    }
    return {type: "literal", value: parseFloat(p.join("") +"." + s.join(""))};
}
StringLiteral "string"
    = "'" v1:[^']* "'"  { return {type: "literal", value: unescape1(v1.join(""))}; }
    / '"' v2:[^"]* '"'  { return {type: "literal", value: unescape2(v1.join(""))}; }

ArrayLiteral "array" = "[" _ h:(Expression)? _ t:("," _ @Expression _)* "]" { 
    const value = h == null ? [] : [h].concat(t);
    return {type: "array", value};
}

DictLiteral "dict" = "{" _ h:(@StringLiteral _ ":" _ @Expression)? _ t:("," _ @StringLiteral _ ":" _ @Expression _)* "}" {
	var value = []
    if (h !== null){
        value.push(h);
    }
    value.push.apply(value, t);
    return {type: "dict", value};   
}

FunctionRef "function-ref"
    = '#' m:(@[a-zA-Z$_]+ ':')* p:[a-zA-Z$_] s:[a-zA-Z$_0-9_]* {
        return {type: 'function', module: m.map(p => p.join('')), value: p + s.join("")}
    }

Symbol "symbol"
    = p:[a-zA-Z$_] s:[a-zA-Z$_0-9_]* { return {type: "symbol", value: p + s.join("")}; }
    
_ "whitespaces"
    = [ \t\n\r]*