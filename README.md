# FTL - HTML template library
FTL is a templating library targeting browsers similar to thymeleaf

## Getting started
- Import the lib via CDN: 
```html
<script src="https://cdn.jsdelivr.net/npm/optionfactory/ftl@{VERSION}/dist/ftl.iife.min.js" integrity="{INTEGRITY}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

- Init `EvaluationContext`, optionally registering custom modules
```javascript
const ec = ftl.EvaluationContext.configure({
        math : {
            isEven: v => v % 2 === 0
        }    
});
```
- Define a template using a template tag, a string, a `DocumentFragment` or a `Node`
```html
<body>
    ...
    <div id="target"></div>
    <template id="my-template">
        <h1>{{title}}</h1>
    </template>
    ...
</body>
```

- Create a template
```javascript
const template = ftl.Template.fromSelector('#my-template', ec);
```
- Render the template
```javascript
const data = {title: 'Hello World!'};
template.renderToSelector('#target', data);
```

## Attributes evaluation
All attributes starting with `data-tpl-` are evaluated in the followind order: 
  - `data-tpl-if`
  - `data-tpl-with`
  - `data-tpl-each`
  - `data-tpl-when`
  - `data-tpl-value`
  - `data-tpl-class-append`
  - `data-tpl-attr-append`
  - `data-tpl-text`
  - `data-tpl-html`
  - `data-tpl-remove`
  - `data-tpl-*`

### data-tpl-if
Removes from the DOM the element if the expression evaluates as false

```html
<h3>Tracking:</h3>
<p data-tpl-if="delivered">Your package has been delivered</p>
```

E.g:
```javascript
data = {delivered: true}
```
```html
<h3>Tracking:</h3>
<p>Your package has been delivered</p>
```

E.g:
```javascript
data = {delivered: false}
```
```html
<h3>Tracking:</h3>
```

### data-tpl-with
Sets the context of the fragment to the specified value

```javascript
data = {
    parent: {
        text: "I'm the parent obj",
        nested: {
            text: "I'm the nested obj",
            label: "fruit",
            fruits: ["apple", "banana", "tomato"]
        }
    }
}
```

```html
<div data-tpl-with="parent.nested"><p>{{text}}</p></div>
```
renders to
```html
<div><p>I'm the nested obj</p></div>
```
It is also possible to assing the evaluated valua to a variable using `data-tpl-var`. This is useful for referencing it from another context.
```html
<div data-tpl-with="parent.nested" data-tpl-var="nested">
    <p>{{nested.text}}</p>
    <div>
        <h3>fruits</h3>
        <p data-tpl-each="nested.fruits">{{nested.label}}: {{self}}</p>
    </div>
</div>
```
that will render to
```html
<div>
    <p>I'm the nested obj</p>
    <div>
        <h3>fruits</h3>
        <p>fruit: apple</p><p>fruit: banana</p><p>fruit: tomato</p>
    </div>
</div>
```

### data-tpl-each
Iterates over given array rendering the tag where the attribut is declared, for each array element. Sets the context to the current element.
```javascript
data = {
    a: [{v: 1}, {v: 2}, {v: 3}]
}
```
```html
<div data-tpl-each="a">{{ v }}</div>
```
renders to
```html
<div>1</div>
<div>2</div>
<div>3</div>
```

### data-tpl-text
Evaluates the given expression and places it as text node inside the given element
```javascript
data = {
    text: "I'm so <i>pretty!</i>"
}
```
```html
<p data-tpl-text="text"></p>
```
renders to
```html
<p>I'm so &lt;i&gt;pretty!&lt;/i&gt;</p>
```

### data-tpl-html
Evaluates the given expression and places it as inner html of the given element
```javascript
data = {
    text: "I'm so <i>pretty!</i>"
}
```
```html
<p data-tpl-html="text"></p>
```
renders to
```html
<p>I'm so <i>pretty!</i></p>
```

### data-tpl-remove
Removes the tag, content or whole element where the attribute is specified
#### data-tpl-remove-tag
```html
<div data-tpl-remove="tag"><p>paragraph</p></div>
```
renders to
```html
<p>paragraph</p>
```
#### data-tpl-remove-body
```html
<div data-tpl-remove="body"><p>paragraph</p></div>
```
renders to
```html
<div></div>
```
#### data-tpl-remove-all
```html
<div data-tpl-remove="all"><p>paragraph</p></div>
```
renders to
```html
```

### data-tpl-*
It is possible to prefix any attribute with `data-tpl-`. It will evaluate the expression and set the result as value of an attribute having the name of the given `data-tpl-` suffix
```javascript
functions = {
    text: {
        concat: (separator, ...txt) => txt.join(separator)
    }
}
data = {
    color: "green"
}
```
```html
<p data-tpl-style="#text:concat(' ', 'color:', color)">To be colored</p>
```
renders to
```html
<p style="color: green">To be colored</p>
```

### Special values

boolean values are always rendered as boolean attributes

```html
<input data-tpl-readonly="true">
```
renders to
```html
<input readonly>
```

`null` and `undefined` values cause the attribute to not be rendered

```html
<input data-tpl-readonly="aNullValue">
```
renders to
```html
<input>
```


## Expression evaluation
### Object navigation
```javascript
data = {
    parent: {
        nested: {text: "I'm the nested obj"}
    }
}
```
```html
<p data-tpl-text="parent.nested.text"></p>
```
renders to
```html
<p>I'm the nested obj</p>
```
### Nullsafe navigation
```javascript
data = {
    parent: {
        empty: null
    }
}
```
```html
<p data-tpl-text="parent.empty?.text"></p>
```
renders to
```html
<p></p>
```
### Bracket notation navigation
```javascript
data = {
    today: "tue",
    carToPick: {
        mon: "Ferrari",
        tue: "Lambo",
        wed: "Porsche"
    }
}
```
```html
<p data-tpl-text="carToPick[today]"></p>
```
renders to
```html
<p>Lambo</p>
```
### Ternary operator
```javascript
data = {
    amIRich: false,
    richCar: "Maserati",
    poorCar: "Mazda"
}
```
```html
<p data-tpl-text="amIRich ? richCar : poorCar"></p>
```
renders to
```html
<p>Mazda</p>
```
### Call a method
```javascript
data = {
    parent: {
        nested: {
            fruits: ["apple", "banana", "tomato"]
        }
    }
}
```
```html
<p data-tpl-text="parent.nested.fruits.join(', ')"></p>
```
renders to
```html
<p>apple, banana, tomato</p>
```

### Evaluate self
The keyword `self` refers to the current context

```javascript
data = {
    parent: {
        nested: {
            fruits: ["apple", "banana", "tomato"]
        }
    }
}
```
```html
<p data-tpl-each="parent.nested.fruits">{{self}}</p>
```
renders to
```html
<p>apple</p><p>banana</p><p>tomato</p>
```

### Define and call a function
Call custom defined functions

```javascript
functions = {
    math: {
        sum: (...addends) => addends.reduce((a,b) => a + b, 0)
    }
}
```
```html
<p data-tpl-text="#math:sum(1, 5, 3, 65)"></p>
```
renders to
```html
<p>74</p>
```
### Operators, literals and precedence

- Dict literals: e.g: `{"a": 1, "b": 2}`
- Array literals: e.g: `[1,2,3]`
- String literals: e.g: `"a"` or `'a'`
- Boolean literals: e.g: `true` or `false`
- Number literals: e.g: `3` or `3.1`
- Function calls: e.g: `#module:fn()` or `#fn(1,2,3)`
- Parenthesized expressions: e.g: `(a || b) && c`
- Method call: e.g: `a.toLowerCase()` or `a.toLowerCase?.()`
- Computed member access: e.g: `a[b]` or `a?.[b]`
- Member access: e.g: `a.b` or `a?.b`
- Logical not operator: e.g: `!a`
- Relational operator: e.g: `a >= b` or `a > b` or `a <= b` or `a <= b`
- Equality operator: e.g: `a == b` or `a != b`
- Logical and operator: e.g: `a && b`
- Logical or operator: e.g: `a || b`
- Null coalescing operator: e.g: `a ?? b`
- Condition ternary operator: e.g: `a ? b : c`

