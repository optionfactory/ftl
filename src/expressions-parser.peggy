{{
    import { nodes } from "./ast.mjs";
}}

TemplatedRoot = TemplatedExpression*

TemplatedExpression = value:(BeginNode @ExpressionRoot EndNode) { return {type:nodes.templated.ten, value}}
	/ value:(BeginHtml @ExpressionRoot EndHtml) { return {type:nodes.templated.teh, value}}
	/ value:(BeginText @ExpressionRoot EndText) { return {type:nodes.templated.tet, value}} 
	/ value:TemplatedText { return {type:nodes.templated.tel, value}}

BeginNode = '{{{{'
EndNode = '}}}}'	
BeginHtml = '{{{'
EndHtml = '}}}'
BeginText = '{{'
EndText = '}}'

TemplatedText
    = v:(
        '\\'@'{'
        / ('\\'@'}')
        / @[^{}] 
        / @'{' !'{' 
        / @'}' !'}'
    )+ { return v.join(""); }


ExpressionRoot
    = _ r:Expression _ { return r; }

Expression = TernaryExpression

TernaryExpression 
    = cond:NullCoalescingExpression _ "?" _ ifTrue:TernaryExpression? _ ":" _ ifFalse:TernaryExpression { return {type:nodes.ter, cond, ifTrue, ifFalse}; }
    / NullCoalescingExpression

NullCoalescingExpression
    = lhs:OrExpression _ "??" _ rhs:NullCoalescingExpression { return {type:nodes.nullc, lhs, rhs}; } 
    / OrExpression

OrExpression 
    = lhs:AndExpression _ "||" _ rhs:OrExpression { return {type:nodes.or, lhs, rhs} }
    / AndExpression

AndExpression
    = lhs:EqExpression _ "&&" _ rhs:AndExpression { return {type:nodes.and, lhs, rhs} }
    / EqExpression

EqExpression
    = lhs:RelExpression _ op:EqualityOp _ rhs:EqExpression { return {type:nodes.eq, op, lhs, rhs} }
    / RelExpression

RelExpression
    = lhs:NotExpression _ op:RelationalOp _ rhs:RelExpression { return {type:nodes.cmp, op, lhs, rhs} }
    / NotExpression

NotExpression
    = "!" _ expr:NotExpression { return {type:nodes.not, expr} }
    / Access


Access    
    = lhs:GroupingExpression _ rhs:(@AccessExpression _)+ { return {type: nodes.access, lhs, rhs} }   
    / GroupingExpression


AccessExpression 
    = AccessMember
    / AccessSubscript 
    / AccessMethodCall
    
AccessMember "member"
    = op:("?."/".") _ rhs:Symbol { 
        return {type: nodes.member, ns: op === '?.', rhs: rhs.value}; 
    }

AccessSubscript "subscript" 
    = op:"?."? "[" _ rhs:Expression _ "]"  { 
        return {type: nodes.subscript, ns: op !== null, rhs}; 
    } 

AccessMethodCall "method-call" 
    = op:"?."? "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" { 
        return {type: nodes.method, ns: op !== null, args: h === null ? [] : [h, ...t]}; 
    }

GroupingExpression 
    = "(" _ e:Expression _ ")" { return e }
    / ModuleFunctionCall 
    / AnyLiteral
    / Symbol


ModuleFunctionCall "module-function-call" 
    = fn:ModuleFunction "(" _ h:(@Expression _)? t:("," _ @Expression _)* ")" {
        const args = h === null ? [] : [h, ...t];
        return {type: nodes.call, value: fn, args};
    }

AnyLiteral
    = NumberLiteral
    / BooleanLiteral
    / StringLiteral
    / ArrayLiteral
    / DictLiteral

BooleanLiteral "boolean-literal"
    = "true" { 
        return {type: nodes.literal, value: true}; 
    }
    / "false" { 
        return {type: nodes.literal, value: false}; 
    }

NumberLiteral "number-literal" = p:$[0-9]+ s:("." @$[0-9]*)? { 
    return { type: nodes.literal, value: s === null ? parseInt(p) : parseFloat(p +"." + s)};
}

StringLiteral "string-literal"
    = "'" value:$[^']* "'"  { return {type: nodes.literal, value}; }
    / '"' value:$[^"]* '"'  { return {type: nodes.literal, value}; }

ArrayLiteral "array-literal" 
    = "[" _ h:(Expression)? _ t:("," _ @Expression _)* "]" { 
        const value = h === null ? [] : [h, ...t];
        return {type: nodes.array, value};
    }

DictLiteral "dict-literal" 
    = "{" _ h:(@StringLiteral _ ":" _ @Expression)? _ t:("," _ @StringLiteral _ ":" _ @Expression _)* "}" {
        var value = []
        if (h !== null){
            value.push(h);
        }
        value.push.apply(value, t);
        return {type: nodes.dict, value};   
    }

ModuleFunction "module-function"
    = '#' module:(@$[a-zA-Z$_]+ ':')? p:[a-zA-Z$_] s:$[a-zA-Z$_0-9_]* {
        return {type: nodes.function, module, value: p + s}
    }

Symbol "symbol"
    = p:[a-zA-Z$_] s:$[a-zA-Z$_0-9_]* { 
        return {type: nodes.symbol, value: p + s}; 
    }
    
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

