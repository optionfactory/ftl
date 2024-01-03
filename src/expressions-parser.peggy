{{

}}

Root 
    = _ r:Expression _ { return r; }

Expression = TernaryExpression

TernaryExpression
    = cond:OrExpression _ "?" _ ifTrue:TernaryExpression? _ ":" _ ifFalse:TernaryExpression { return {type:"ter", cond, ifTrue, ifFalse}; }
    / OrExpression

OrExpression 
    = lhs:AndExpression _ "||" _ rhs:OrExpression { return {type:"or", lhs, rhs} }
    / AndExpression

AndExpression
    = lhs:EqExpression _ "&&" _ rhs:AndExpression { return {type:"and", lhs, rhs} }
    / EqExpression

EqExpression
    = lhs:RelExpression _ op:EqualityOp _ rhs:EqExpression { return {type:"eq", op, lhs, rhs} }
    / RelExpression

RelExpression
    = lhs:NotExpression _ op:RelationalOp _ rhs:RelExpression { return {type:"cmp", op, lhs, rhs} }
    / NotExpression

NotExpression
    = "!" _ expr:NotExpression { return {type:"not", expr} }
    / Navigation


Navigation    
    = lhs:ParensExpression _ rhs:(@NavigationExpression _)+ { return {type: "nav", lhs, rhs} }   
    / ParensExpression


NavigationExpression 
    = NavigationMemberAccess 
    / NavigationSubscript 
    / NavigationMethod
    
NavigationMemberAccess = op:("?."/".") _ rhs:Symbol { return {type: "dot", ns: op === '?.', rhs: rhs.value}; }
NavigationSubscript "subscript" = op:"?."? "[" _ rhs:Expression _ "]"  { return {type: "sub", ns: op !== null, rhs}; } 
NavigationMethod "methodCall" = op:"?."? "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" { return {type: "method", ns: op !== null, args: h == null ? [] : [h].concat(t)}; }

ParensExpression = "(" _ e:Expression _ ")" { return e }
    / FunctionCall 
    / AnyLiteral
    / Symbol


FunctionCall "functionCall" 
    = fn:FunctionRef "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" {
        const args = h == null ? [] : [h].concat(t);
        return {type: "call", value: fn, args};
    }

AnyLiteral
    = NumberLiteral
    / BooleanLiteral
    / StringLiteral
    / ArrayLiteral
    / DictLiteral

BooleanLiteral "boolean"
    = "true" { return {type: "literal", value: true}; }
    / "false" { return {type: "literal", value: false}; }

NumberLiteral "number" = p:$[0-9]+ s:("." @$[0-9]*)? { 
    if (s == null){
        return {type: "literal", value: parseInt(p)};
    }
    return {type: "literal", value: parseFloat(p +"." + s)};
}

StringLiteral "string"
    = "'" value:$[^']* "'"  { return {type: "literal", value}; }
    / '"' value:$[^"]* '"'  { return {type: "literal", value}; }

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
    = '#' module:(@$[a-zA-Z$_]+ ':')? p:[a-zA-Z$_] s:$[a-zA-Z$_0-9_]* {
        return {type: 'function', module, value: p + s}
    }

Symbol "symbol"
    = p:[a-zA-Z$_] s:$[a-zA-Z$_0-9_]* { return {type: "symbol", value: p + s}; }
    
AccessOp 
    = "."
    / "?."

EqualityOp
    = "=="
    / "!="

RelationalOp
    = ">="
    / ">"
    / "<="
    / "<"

_ "whitespaces"
    = [ \t\n\r]*