Root = Expression*

Expression = v:(BeginHtml @Other EndHtml) { return {t:'he', v}} 
	/ v:(BeginText @Other EndText) { return {t:'te', v}} 
	/ v:Other { return {t:'t', v}}
	
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