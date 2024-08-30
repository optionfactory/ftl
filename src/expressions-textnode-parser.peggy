TemplatedRoot = TemplatedExpression*

TemplatedExpression = v:(BeginNode @Other EndNode) { return {t:'ne', v}}
	/ v:(BeginHtml @Other EndHtml) { return {t:'he', v}}
	/ v:(BeginText @Other EndText) { return {t:'te', v}} 
	/ v:Other { return {t:'t', v}}

BeginNode = '{{{{'
EndNode = '}}}}'	
BeginHtml = '{{{'
EndHtml = '}}}'
BeginText = '{{'
EndText = '}}'

Other = v:(
    EscapedBegin
    / EscapedEnd
	/ @[^{}] 
    / @'{' !'{' 
    / @'}' !'}'
)+ { return v.join(""); }
EscapedBegin = '\\'@'{'
EscapedEnd = ('\\'@'}')