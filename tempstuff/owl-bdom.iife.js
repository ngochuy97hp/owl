(function (exports) {
    'use strict';

    /**
     * Block DOM
     *
     * A virtual-dom inspired implementation, but where the basic primitive is a
     * "block" instead of just a html (v)node.
     */
    class Block {
        constructor() {
            this.el = null;
        }
        mount(parent) {
            const anchor = document.createTextNode("");
            parent.appendChild(anchor);
            this.mountBefore(anchor);
            anchor.remove();
        }
        remove() { }
    }
    class HTMLBlock extends Block {
        constructor(html) {
            super();
            this.content = [];
            this.html = String(html);
            this.anchor = document.createTextNode("");
        }
        mountBefore(anchor) {
            this.build();
            anchor.before(this.anchor);
            for (let elem of this.content) {
                this.anchor.before(elem);
            }
        }
        build() {
            const div = document.createElement("div");
            div.innerHTML = this.html;
            this.content = [...div.childNodes];
            this.el = this.content[0];
        }
        remove() {
            for (let elem of this.content) {
                elem.remove();
            }
            this.anchor.remove();
        }
        patch(other) {
            for (let elem of this.content) {
                elem.remove();
            }
            this.build();
            for (let elem of this.content) {
                this.anchor.before(elem);
            }
        }
        toString() {
            return this.html;
        }
    }
    class TextBlock extends Block {
        constructor(text) {
            super();
            this.el = document.createTextNode(text);
        }
        mountBefore(anchor) {
            anchor.before(this.el);
        }
        patch(other) {
            this.el.textContent = other.el.textContent;
        }
        toString() {
            return this.el.textContent;
        }
    }
    class ContentBlock extends Block {
        constructor() {
            super(...arguments);
            // el?: HTMLElement | Text;
            this.children = null;
            this.data = [];
        }
        toString() {
            const div = document.createElement("div");
            this.mount(div);
            return div.innerHTML;
        }
        mountBefore(anchor) {
            this.build();
            if (this.children) {
                for (let i = 0; i < this.children.length; i++) {
                    const child = this.children[i];
                    if (child) {
                        const anchor = this.anchors[i];
                        child.mountBefore(anchor);
                    }
                }
            }
            anchor.before(this.el);
        }
        update() { }
        updateClass(elem, _class) {
            if (_class) {
                elem.classList.add(_class);
            }
        }
        updateAttr(elem, attr, value) {
            if (value) {
                elem.setAttribute(attr, value);
            }
            else {
                elem.removeAttribute(attr);
            }
        }
        build() {
            this.el = this.constructor.el.cloneNode(true);
            if (this.children) {
                const anchorElems = this.el.getElementsByTagName("owl-anchor");
                const anchors = new Array(anchorElems.length);
                for (let i = 0; i < anchors.length; i++) {
                    const text = document.createTextNode("");
                    anchorElems[0].replaceWith(text); // the 0 is not a mistake: anchorElems is live collection
                    anchors[i] = text;
                }
                this.anchors = anchors;
            }
            this.update();
        }
        patch(newTree) {
            this.data = newTree.data;
            this.update();
            if (this.children) {
                const children = this.children;
                const newChildren = newTree.children;
                for (let i = 0; i < newChildren.length; i++) {
                    const newChild = newChildren[i];
                    const child = children[i];
                    if (child) {
                        if (newChild) {
                            child.patch(newChild);
                        }
                        else {
                            children[i] = null;
                            child.remove();
                        }
                    }
                    else if (newChild) {
                        children[i] = newChild;
                        const anchor = this.anchors[i];
                        newChild.mountBefore(anchor);
                    }
                }
            }
        }
        remove() {
            this.el.remove();
        }
    }
    class MultiBlock extends Block {
        constructor(n) {
            super();
            this.children = new Array(n);
            this.anchors = new Array(n);
        }
        mountBefore(anchor) {
            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];
                const childAnchor = document.createTextNode("");
                anchor.before(childAnchor);
                this.anchors[i] = childAnchor;
                if (child) {
                    child.mountBefore(childAnchor);
                }
            }
        }
        patch(newTree) {
            for (let i = 0; i < this.children.length; i++) {
                const block = this.children[i];
                const newBlock = newTree.children[i];
                if (block) {
                    if (newBlock) {
                        block.patch(newBlock);
                    }
                    else {
                        this.children[0] = null;
                        block.remove();
                    }
                }
                else if (newBlock) {
                    this.children[i] = newBlock;
                    newBlock.mountBefore(this.anchors[i]);
                }
            }
        }
        remove() {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].remove();
                this.anchors[i].remove();
            }
        }
        toString() {
            return this.children.map((c) => (c ? c.toString() : "")).join("");
        }
    }
    class CollectionBlock extends Block {
        constructor(n) {
            super();
            this.children = new Array(n);
        }
        mountBefore(anchor) {
            const _anchor = document.createTextNode("");
            anchor.before(_anchor);
            this.anchor = _anchor;
            for (let child of this.children) {
                child.mountBefore(_anchor);
            }
        }
        patch() { }
    }

    /**
     * Owl QWeb Expression Parser
     *
     * Owl needs in various contexts to be able to understand the structure of a
     * string representing a javascript expression.  The usual goal is to be able
     * to rewrite some variables.  For example, if a template has
     *
     *  ```xml
     *  <t t-if="computeSomething({val: state.val})">...</t>
     * ```
     *
     * this needs to be translated in something like this:
     *
     * ```js
     *   if (context["computeSomething"]({val: context["state"].val})) { ... }
     * ```
     *
     * This file contains the implementation of an extremely naive tokenizer/parser
     * and evaluator for javascript expressions.  The supported grammar is basically
     * only expressive enough to understand the shape of objects, of arrays, and
     * various operators.
     */
    //------------------------------------------------------------------------------
    // Misc types, constants and helpers
    //------------------------------------------------------------------------------
    const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,eval,void,Math,RegExp,Array,Object,Date".split(",");
    const WORD_REPLACEMENT = {
        and: "&&",
        or: "||",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
    };
    const STATIC_TOKEN_MAP = {
        "{": "LEFT_BRACE",
        "}": "RIGHT_BRACE",
        "[": "LEFT_BRACKET",
        "]": "RIGHT_BRACKET",
        ":": "COLON",
        ",": "COMMA",
        "(": "LEFT_PAREN",
        ")": "RIGHT_PAREN",
    };
    // note that the space after typeof is relevant. It makes sure that the formatted
    // expression has a space after typeof
    const OPERATORS = "...,.,===,==,+,!==,!=,!,||,&&,>=,>,<=,<,?,-,*,/,%,typeof ,=>,=,;,in ".split(",");
    let tokenizeString = function (expr) {
        let s = expr[0];
        let start = s;
        if (s !== "'" && s !== '"') {
            return false;
        }
        let i = 1;
        let cur;
        while (expr[i] && expr[i] !== start) {
            cur = expr[i];
            s += cur;
            if (cur === "\\") {
                i++;
                cur = expr[i];
                if (!cur) {
                    throw new Error("Invalid expression");
                }
                s += cur;
            }
            i++;
        }
        if (expr[i] !== start) {
            throw new Error("Invalid expression");
        }
        s += start;
        return { type: "VALUE", value: s };
    };
    let tokenizeNumber = function (expr) {
        let s = expr[0];
        if (s && s.match(/[0-9]/)) {
            let i = 1;
            while (expr[i] && expr[i].match(/[0-9]|\./)) {
                s += expr[i];
                i++;
            }
            return { type: "VALUE", value: s };
        }
        else {
            return false;
        }
    };
    let tokenizeSymbol = function (expr) {
        let s = expr[0];
        if (s && s.match(/[a-zA-Z_\$]/)) {
            let i = 1;
            while (expr[i] && expr[i].match(/\w/)) {
                s += expr[i];
                i++;
            }
            if (s in WORD_REPLACEMENT) {
                return { type: "OPERATOR", value: WORD_REPLACEMENT[s], size: s.length };
            }
            return { type: "SYMBOL", value: s };
        }
        else {
            return false;
        }
    };
    const tokenizeStatic = function (expr) {
        const char = expr[0];
        if (char && char in STATIC_TOKEN_MAP) {
            return { type: STATIC_TOKEN_MAP[char], value: char };
        }
        return false;
    };
    const tokenizeOperator = function (expr) {
        for (let op of OPERATORS) {
            if (expr.startsWith(op)) {
                return { type: "OPERATOR", value: op };
            }
        }
        return false;
    };
    const TOKENIZERS = [
        tokenizeString,
        tokenizeNumber,
        tokenizeOperator,
        tokenizeSymbol,
        tokenizeStatic,
    ];
    /**
     * Convert a javascript expression (as a string) into a list of tokens. For
     * example: `tokenize("1 + b")` will return:
     * ```js
     *  [
     *   {type: "VALUE", value: "1"},
     *   {type: "OPERATOR", value: "+"},
     *   {type: "SYMBOL", value: "b"}
     * ]
     * ```
     */
    function tokenize(expr) {
        const result = [];
        let token = true;
        while (token) {
            expr = expr.trim();
            if (expr) {
                for (let tokenizer of TOKENIZERS) {
                    token = tokenizer(expr);
                    if (token) {
                        result.push(token);
                        expr = expr.slice(token.size || token.value.length);
                        break;
                    }
                }
            }
            else {
                token = false;
            }
        }
        if (expr.length) {
            throw new Error(`Tokenizer error: could not tokenize "${expr}"`);
        }
        return result;
    }
    //------------------------------------------------------------------------------
    // Expression "evaluator"
    //------------------------------------------------------------------------------
    /**
     * This is the main function exported by this file. This is the code that will
     * process an expression (given as a string) and returns another expression with
     * proper lookups in the context.
     *
     * Usually, this kind of code would be very simple to do if we had an AST (so,
     * if we had a javascript parser), since then, we would only need to find the
     * variables and replace them.  However, a parser is more complicated, and there
     * are no standard builtin parser API.
     *
     * Since this method is applied to simple javasript expressions, and the work to
     * be done is actually quite simple, we actually can get away with not using a
     * parser, which helps with the code size.
     *
     * Here is the heuristic used by this method to determine if a token is a
     * variable:
     * - by default, all symbols are considered a variable
     * - unless the previous token is a dot (in that case, this is a property: `a.b`)
     * - or if the previous token is a left brace or a comma, and the next token is
     *   a colon (in that case, this is an object key: `{a: b}`)
     *
     * Some specific code is also required to support arrow functions. If we detect
     * the arrow operator, then we add the current (or some previous tokens) token to
     * the list of variables so it does not get replaced by a lookup in the context
     */
    function compileExprToArray(expr) {
        const localVars = new Set();
        const tokens = tokenize(expr);
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            let prevToken = tokens[i - 1];
            let nextToken = tokens[i + 1];
            let isVar = token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value);
            if (token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value)) {
                if (prevToken) {
                    if (prevToken.type === "OPERATOR" && prevToken.value === ".") {
                        isVar = false;
                    }
                    else if (prevToken.type === "LEFT_BRACE" || prevToken.type === "COMMA") {
                        if (nextToken && nextToken.type === "COLON") {
                            isVar = false;
                        }
                    }
                }
            }
            if (nextToken && nextToken.type === "OPERATOR" && nextToken.value === "=>") {
                if (token.type === "RIGHT_PAREN") {
                    let j = i - 1;
                    while (j > 0 && tokens[j].type !== "LEFT_PAREN") {
                        if (tokens[j].type === "SYMBOL" && tokens[j].originalValue) {
                            tokens[j].value = tokens[j].originalValue;
                            localVars.add(tokens[j].value);
                        }
                        j--;
                    }
                }
                else {
                    localVars.add(token.value);
                }
            }
            if (isVar) {
                token.varName = token.value;
                if (!localVars.has(token.value)) {
                    token.originalValue = token.value;
                    token.value = `ctx['${token.value}']`;
                }
            }
        }
        return tokens;
    }
    function compileExpr(expr) {
        return compileExprToArray(expr)
            .map((t) => t.value)
            .join("");
    }

    // -----------------------------------------------------------------------------
    // AST Type definition
    // -----------------------------------------------------------------------------
    var ASTType;
    (function (ASTType) {
        ASTType[ASTType["Text"] = 0] = "Text";
        ASTType[ASTType["Comment"] = 1] = "Comment";
        ASTType[ASTType["DomNode"] = 2] = "DomNode";
        ASTType[ASTType["Multi"] = 3] = "Multi";
        ASTType[ASTType["TEsc"] = 4] = "TEsc";
        ASTType[ASTType["TIf"] = 5] = "TIf";
        ASTType[ASTType["TSet"] = 6] = "TSet";
        ASTType[ASTType["TCall"] = 7] = "TCall";
        ASTType[ASTType["TRaw"] = 8] = "TRaw";
        ASTType[ASTType["TForEach"] = 9] = "TForEach";
        ASTType[ASTType["TKey"] = 10] = "TKey";
    })(ASTType || (ASTType = {}));
    function parse(xml) {
        const template = `<t>${xml}</t>`;
        const doc = parseXML(template);
        const ctx = { inPreTag: false };
        const ast = parseNode(doc.firstChild, ctx);
        if (!ast) {
            return { type: 0 /* Text */, value: "" };
        }
        return ast;
    }
    function parseNode(node, ctx) {
        if (!(node instanceof Element)) {
            return parseTextCommentNode(node, ctx);
        }
        return (parseTIf(node, ctx) ||
            parseTEscNode(node, ctx) ||
            parseTCall(node, ctx) ||
            parseTForEach(node, ctx) ||
            parseTKey(node, ctx) ||
            parseTRawNode(node, ctx) ||
            parseDOMNode(node, ctx) ||
            parseTSetNode(node, ctx) ||
            parseTNode(node, ctx));
    }
    // -----------------------------------------------------------------------------
    // <t /> tag
    // -----------------------------------------------------------------------------
    function parseTNode(node, ctx) {
        if (node.tagName !== "t") {
            return null;
        }
        const children = [];
        for (let child of node.childNodes) {
            const ast = parseNode(child, ctx);
            if (ast) {
                children.push(ast);
            }
        }
        switch (children.length) {
            case 0:
                return null;
            case 1:
                return children[0];
            default:
                return {
                    type: 3 /* Multi */,
                    content: children,
                };
        }
    }
    // -----------------------------------------------------------------------------
    // Text and Comment Nodes
    // -----------------------------------------------------------------------------
    const lineBreakRE = /[\r\n]/;
    const whitespaceRE = /\s+/g;
    function parseTextCommentNode(node, ctx) {
        if (node.nodeType === 3) {
            let value = node.textContent || "";
            if (!ctx.inPreTag) {
                if (lineBreakRE.test(value) && !value.trim()) {
                    return null;
                }
                value = value.replace(whitespaceRE, " ");
            }
            return { type: 0 /* Text */, value };
        }
        else if (node.nodeType === 8) {
            return { type: 1 /* Comment */, value: node.textContent || "" };
        }
        return null;
    }
    // -----------------------------------------------------------------------------
    // Regular dom node
    // -----------------------------------------------------------------------------
    function parseDOMNode(node, ctx) {
        if (node.tagName === "t") {
            return null;
        }
        const children = [];
        if (node.tagName === "pre") {
            ctx = { inPreTag: true };
        }
        for (let child of node.childNodes) {
            const ast = parseNode(child, ctx);
            if (ast) {
                children.push(ast);
            }
        }
        const attrs = {};
        for (let attr of node.getAttributeNames()) {
            attrs[attr] = node.getAttribute(attr);
        }
        return {
            type: 2 /* DomNode */,
            tag: node.tagName,
            attrs,
            content: children,
        };
    }
    // -----------------------------------------------------------------------------
    // t-esc
    // -----------------------------------------------------------------------------
    function parseTEscNode(node, ctx) {
        if (!node.hasAttribute("t-esc")) {
            return null;
        }
        const escValue = node.getAttribute("t-esc");
        node.removeAttribute("t-esc");
        const tesc = {
            type: 4 /* TEsc */,
            expr: escValue,
            defaultValue: node.textContent || "",
        };
        const ast = parseNode(node, ctx);
        if (!ast) {
            return tesc;
        }
        if (ast && ast.type === 2 /* DomNode */) {
            return {
                type: 2 /* DomNode */,
                tag: ast.tag,
                attrs: ast.attrs,
                content: [tesc],
            };
        }
        return tesc;
    }
    // -----------------------------------------------------------------------------
    // t-raw
    // -----------------------------------------------------------------------------
    function parseTRawNode(node, ctx) {
        if (!node.hasAttribute("t-raw")) {
            return null;
        }
        const expr = node.getAttribute("t-raw");
        node.removeAttribute("t-raw");
        const tRaw = { type: 8 /* TRaw */, expr, body: null };
        const ast = parseNode(node, ctx);
        if (!ast) {
            return tRaw;
        }
        if (ast && ast.type === 2 /* DomNode */) {
            tRaw.body = ast.content.length ? ast.content : null;
            return {
                type: 2 /* DomNode */,
                tag: ast.tag,
                attrs: ast.attrs,
                content: [tRaw],
            };
        }
        return tRaw;
    }
    // -----------------------------------------------------------------------------
    // t-foreach and t-key
    // -----------------------------------------------------------------------------
    function parseTForEach(node, ctx) {
        if (!node.hasAttribute("t-foreach")) {
            return null;
        }
        const collection = node.getAttribute("t-foreach");
        node.removeAttribute("t-foreach");
        const elem = node.getAttribute("t-as") || "";
        node.removeAttribute("t-as");
        const body = parseNode(node, ctx);
        if (!body) {
            return null;
        }
        return {
            type: 9 /* TForEach */,
            collection,
            elem,
            body,
        };
    }
    function parseTKey(node, ctx) {
        if (!node.hasAttribute("t-key")) {
            return null;
        }
        const key = node.getAttribute("t-key");
        node.removeAttribute("t-key");
        const body = parseNode(node, ctx);
        if (!body) {
            return null;
        }
        return { type: 10 /* TKey */, expr: key, content: body };
    }
    // -----------------------------------------------------------------------------
    // t-call
    // -----------------------------------------------------------------------------
    function parseTCall(node, ctx) {
        if (!node.hasAttribute("t-call")) {
            return null;
        }
        const subTemplate = node.getAttribute("t-call");
        node.removeAttribute("t-call");
        if (node.tagName !== "t") {
            const ast = parseNode(node, ctx);
            if (ast && ast.type === 2 /* DomNode */) {
                ast.content = [{ type: 7 /* TCall */, name: subTemplate, body: null }];
                return ast;
            }
        }
        const body = [];
        for (let child of node.childNodes) {
            const ast = parseNode(child, ctx);
            if (ast) {
                body.push(ast);
            }
        }
        return {
            type: 7 /* TCall */,
            name: subTemplate,
            body: body.length ? body : null,
        };
    }
    // -----------------------------------------------------------------------------
    // t-if
    // -----------------------------------------------------------------------------
    function parseTIf(node, ctx) {
        if (!node.hasAttribute("t-if")) {
            return null;
        }
        const condition = node.getAttribute("t-if");
        node.removeAttribute("t-if");
        const content = parseNode(node, ctx);
        if (!content) {
            throw new Error("hmmm");
        }
        let nextElement = node.nextElementSibling;
        // t-elifs
        const tElifs = [];
        while (nextElement && nextElement.hasAttribute("t-elif")) {
            const condition = nextElement.getAttribute("t-elif");
            nextElement.removeAttribute("t-elif");
            const tElif = parseNode(nextElement, ctx);
            const next = nextElement.nextElementSibling;
            nextElement.remove();
            nextElement = next;
            if (tElif) {
                tElifs.push({ condition, content: tElif });
            }
        }
        // t-else
        let tElse = null;
        if (nextElement && nextElement.hasAttribute("t-else")) {
            nextElement.removeAttribute("t-else");
            tElse = parseNode(nextElement, ctx);
            nextElement.remove();
        }
        return {
            type: 5 /* TIf */,
            condition,
            content,
            tElif: tElifs.length ? tElifs : null,
            tElse,
        };
    }
    // -----------------------------------------------------------------------------
    // t-set directive
    // -----------------------------------------------------------------------------
    function parseTSetNode(node, ctx) {
        if (!node.hasAttribute("t-set")) {
            return null;
        }
        const name = node.getAttribute("t-set");
        const value = node.getAttribute("t-value") || null;
        const defaultValue = node.innerHTML === node.textContent ? node.textContent || null : null;
        let body = null;
        if (node.textContent !== node.innerHTML) {
            body = [];
            for (let child of node.childNodes) {
                let childAst = parseNode(child, ctx);
                if (childAst) {
                    body.push(childAst);
                }
            }
        }
        return { type: 6 /* TSet */, name, value, defaultValue, body };
    }
    // -----------------------------------------------------------------------------
    // parse XML
    // -----------------------------------------------------------------------------
    function parseXML(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        if (doc.getElementsByTagName("parsererror").length) {
            let msg = "Invalid XML in template.";
            const parsererrorText = doc.getElementsByTagName("parsererror")[0].textContent;
            if (parsererrorText) {
                msg += "\nThe parser has produced the following error message:\n" + parsererrorText;
                const re = /\d+/g;
                const firstMatch = re.exec(parsererrorText);
                if (firstMatch) {
                    const lineNumber = Number(firstMatch[0]);
                    const line = xml.split("\n")[lineNumber - 1];
                    const secondMatch = re.exec(parsererrorText);
                    if (line && secondMatch) {
                        const columnIndex = Number(secondMatch[0]) - 1;
                        if (line[columnIndex]) {
                            msg +=
                                `\nThe error might be located at xml line ${lineNumber} column ${columnIndex}\n` +
                                    `${line}\n${"-".repeat(columnIndex - 1)}^`;
                        }
                    }
                }
            }
            throw new Error(msg);
        }
        let tbranch = doc.querySelectorAll("[t-elif], [t-else]");
        for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
            let node = tbranch[i];
            let prevElem = node.previousElementSibling;
            let pattr = (name) => prevElem.getAttribute(name);
            let nattr = (name) => +!!node.getAttribute(name);
            if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
                if (pattr("t-foreach")) {
                    throw new Error("t-if cannot stay at the same level as t-foreach when using t-elif or t-else");
                }
                if (["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
                    return a + b;
                }) > 1) {
                    throw new Error("Only one conditional branching directive is allowed per node");
                }
                // All text (with only spaces) and comment nodes (nodeType 8) between
                // branch nodes are removed
                let textNode;
                while ((textNode = node.previousSibling) !== prevElem) {
                    if (textNode.nodeValue.trim().length && textNode.nodeType !== 8) {
                        throw new Error("text is not allowed between branching directives");
                    }
                    textNode.remove();
                }
            }
            else {
                throw new Error("t-elif and t-else directives must be preceded by a t-if or t-elif directive");
            }
        }
        return doc;
    }

    const INTERP_REGEXP = /\{\{.*?\}\}/g;
    function interpolate(s) {
        let matches = s.match(INTERP_REGEXP);
        if (matches && matches[0].length === s.length) {
            return `(${compileExpr(s.slice(2, -2))})`;
        }
        let r = s.replace(/\{\{.*?\}\}/g, (s) => "${" + compileExpr(s.slice(2, -2)) + "}");
        return "`" + r + "`";
    }
    // -----------------------------------------------------------------------------
    // Compile functions
    // -----------------------------------------------------------------------------
    const Blocks = { ContentBlock, MultiBlock, HTMLBlock, CollectionBlock, TextBlock };
    const UTILS = {
        elem,
        toString,
        withDefault,
        call,
        zero: Symbol("zero"),
        getValues,
    };
    function compileTemplate(template) {
        const ast = parse(template);
        // console.warn(ast);
        const ctx = new CompilationContext();
        compileAST(ast, null, 0, false, ctx);
        const code = ctx.generateCode();
        // console.warn(code);
        return new Function("Blocks, utils", code);
    }
    class TemplateSet {
        constructor() {
            this.templates = {};
            this.compiledTemplates = {};
            const call = (subTemplate, ctx) => {
                const renderFn = this.getFunction(subTemplate);
                return renderFn(ctx);
            };
            this.utils = Object.assign({}, UTILS, { call });
        }
        add(name, template) {
            this.templates[name] = template;
        }
        getFunction(name) {
            if (!(name in this.compiledTemplates)) {
                const template = this.templates[name];
                if (!template) {
                    throw new Error(`Missing template: "${name}"`);
                }
                const templateFn = compileTemplate(template);
                const renderFn = templateFn(Blocks, this.utils);
                this.compiledTemplates[name] = renderFn;
            }
            return this.compiledTemplates[name];
        }
    }
    var DomType;
    (function (DomType) {
        DomType[DomType["Text"] = 0] = "Text";
        DomType[DomType["Comment"] = 1] = "Comment";
        DomType[DomType["Node"] = 2] = "Node";
    })(DomType || (DomType = {}));
    class CompilationContext {
        constructor() {
            this.code = [];
            this.indentLevel = 0;
            this.blocks = [];
            this.rootBlock = null;
            this.nextId = 1;
            this.shouldProtectScope = false;
            this.key = null;
            this.loopLevel = 0;
        }
        addLine(line) {
            const prefix = new Array(this.indentLevel + 2).join("  ");
            this.code.push(prefix + line);
        }
        generateId(prefix = "") {
            return `${prefix}${this.nextId++}`;
        }
        makeBlock({ multi, parentBlock, parentIndex } = {}) {
            const name = multi ? "MultiBlock" : `Block${this.blocks.length + 1}`;
            const block = {
                name,
                varName: this.generateId("b"),
                updateFn: [],
                currentPath: ["el"],
                textNumber: 0,
                childNumber: 0,
            };
            if (!multi) {
                this.blocks.push(block);
            }
            if (!this.rootBlock) {
                this.rootBlock = block.varName;
            }
            const parentStr = parentBlock ? `${parentBlock}.children[${parentIndex}] = ` : "";
            this.addLine(`const ${block.varName} = ${parentStr}new ${block.name}(${multi || ""});`);
            return block;
        }
        generateCode() {
            let mainCode = this.code;
            this.code = [];
            this.indentLevel = 0;
            // define blocks and utility functions
            this.addLine(`let {MultiBlock, TextBlock, ContentBlock, CollectionBlock, HTMLBlock} = Blocks;`);
            this.addLine(`let {elem, toString, withDefault, call, zero, getValues} = utils;`);
            this.addLine(``);
            // define all blocks
            for (let block of this.blocks) {
                this.addLine(`class ${block.name} extends ContentBlock {`);
                this.indentLevel++;
                this.addLine(`static el = elem(\`${block.dom ? domToString(block.dom) : ""}\`);`);
                if (block.childNumber) {
                    this.addLine(`children = new Array(${block.childNumber});`);
                }
                if (block.textNumber) {
                    this.addLine(`data = new Array(${block.textNumber});`);
                }
                if (block.updateFn.length) {
                    const updateInfo = block.updateFn;
                    this.addLine(`update() {`);
                    this.indentLevel++;
                    if (updateInfo.length === 1) {
                        const { path, inserter } = updateInfo[0];
                        const target = `this.${path.join(".")}`;
                        this.addLine(inserter(target));
                    }
                    else {
                        // build tree of paths
                        const tree = {};
                        let i = 1;
                        for (let line of block.updateFn) {
                            let current = tree;
                            let el = `this`;
                            for (let p of line.path.slice()) {
                                if (current[p]) ;
                                else {
                                    current[p] = { firstChild: null, nextSibling: null };
                                }
                                if (current.firstChild && current.nextSibling && !current.name) {
                                    current.name = `el${i++}`;
                                    this.addLine(`const ${current.name} = ${el};`);
                                }
                                el = `${current.name ? current.name : el}.${p}`;
                                current = current[p];
                                if (current.target && !current.name) {
                                    current.name = `el${i++}`;
                                    this.addLine(`const ${current.name} = ${el};`);
                                }
                            }
                            current.target = true;
                        }
                        for (let line of block.updateFn) {
                            const { path, inserter } = line;
                            let current = tree;
                            let el = `this`;
                            for (let p of path.slice()) {
                                current = current[p];
                                if (current) {
                                    if (current.name) {
                                        el = current.name;
                                    }
                                    else {
                                        el = `${el}.${p}`;
                                    }
                                }
                                else {
                                    el = `${el}.${p}`;
                                }
                            }
                            this.addLine(inserter(el));
                        }
                    }
                    this.indentLevel--;
                    this.addLine(`}`);
                }
                this.indentLevel--;
                this.addLine(`}`);
            }
            // micro optimization: remove trailing ctx = ctx.__proto__;
            if (mainCode[mainCode.length - 1] === `  ctx = ctx.__proto__;`) {
                mainCode = mainCode.slice(0, -1);
            }
            // generate main code
            this.indentLevel = 0;
            this.addLine(``);
            this.addLine(`return ctx => {`);
            if (this.shouldProtectScope) {
                this.addLine(`  ctx = Object.create(ctx);`);
            }
            for (let line of mainCode) {
                this.addLine(line);
            }
            if (!this.rootBlock) {
                throw new Error("missing root block");
            }
            this.addLine(`  return ${this.rootBlock};`);
            this.addLine("}");
            return this.code.join("\n");
        }
    }
    // -----------------------------------------------------------------------------
    // Compiler code
    // -----------------------------------------------------------------------------
    function domToString(dom) {
        switch (dom.type) {
            case 0 /* Text */:
                return dom.value;
            case 1 /* Comment */:
                return `<!--${dom.value}-->`;
            case 2 /* Node */:
                const content = dom.content.map(domToString).join("");
                const attrs = [];
                for (let [key, value] of Object.entries(dom.attrs)) {
                    if (!(key === "class" && value === "")) {
                        attrs.push(`${key}="${value}"`);
                    }
                }
                return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}>${content}</${dom.tag}>`;
        }
    }
    function addToBlockDom(block, dom) {
        if (block.currentDom) {
            block.currentDom.content.push(dom);
        }
        else {
            block.dom = dom;
        }
    }
    function updateBlockFn(block, inserter) {
        block.updateFn.push({ path: block.currentPath.slice(), inserter });
    }
    function compileAST(ast, currentBlock, currentIndex, forceNewBlock, ctx) {
        switch (ast.type) {
            // -------------------------------------------------------------------------
            // Comment/Text
            // -------------------------------------------------------------------------
            case 1 /* Comment */: {
                if (!currentBlock || forceNewBlock) {
                    currentBlock = ctx.makeBlock({
                        parentIndex: currentIndex,
                        parentBlock: currentBlock ? currentBlock.varName : undefined,
                    });
                }
                const text = { type: 1 /* Comment */, value: ast.value };
                addToBlockDom(currentBlock, text);
                break;
            }
            case 0 /* Text */: {
                if (!currentBlock || forceNewBlock) {
                    if (currentBlock) {
                        ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = new TextBlock(\`${ast.value}\`)`);
                    }
                    else {
                        const id = ctx.generateId("b");
                        ctx.addLine(`const ${id} = new TextBlock(\`${ast.value}\`)`);
                        if (!ctx.rootBlock) {
                            ctx.rootBlock = id;
                        }
                    }
                }
                else {
                    const type = ast.type === 0 /* Text */ ? 0 /* Text */ : 1 /* Comment */;
                    const text = { type, value: ast.value };
                    addToBlockDom(currentBlock, text);
                }
                break;
            }
            // -------------------------------------------------------------------------
            // Dom Node
            // -------------------------------------------------------------------------
            case 2 /* DomNode */: {
                if (!currentBlock || forceNewBlock) {
                    currentBlock = ctx.makeBlock({
                        parentIndex: currentIndex,
                        parentBlock: currentBlock ? currentBlock.varName : undefined,
                    });
                }
                const staticAttrs = {};
                const dynAttrs = {};
                for (let key in ast.attrs) {
                    if (key.startsWith("t-attf")) {
                        dynAttrs[key.slice(7)] = interpolate(ast.attrs[key]);
                    }
                    else if (key.startsWith("t-att")) {
                        dynAttrs[key.slice(6)] = compileExpr(ast.attrs[key]);
                    }
                    else {
                        staticAttrs[key] = ast.attrs[key];
                    }
                }
                if (Object.keys(dynAttrs).length) {
                    for (let key in dynAttrs) {
                        const idx = currentBlock.textNumber;
                        currentBlock.textNumber++;
                        ctx.addLine(`${currentBlock.varName}.data[${idx}] = ${dynAttrs[key]};`);
                        if (key === "class") {
                            updateBlockFn(currentBlock, (targetEl) => `this.updateClass(${targetEl}, this.data[${idx}]);`);
                        }
                        else {
                            updateBlockFn(currentBlock, (targetEl) => `this.updateAttr(${targetEl}, \`${key}\`, this.data[${idx}]);`);
                        }
                    }
                }
                const dom = { type: 2 /* Node */, tag: ast.tag, attrs: staticAttrs, content: [] };
                addToBlockDom(currentBlock, dom);
                if (ast.content.length) {
                    const initialDom = currentBlock.currentDom;
                    currentBlock.currentDom = dom;
                    const path = currentBlock.currentPath.slice();
                    currentBlock.currentPath.push("firstChild");
                    for (let child of ast.content) {
                        compileAST(child, currentBlock, currentBlock.childNumber, false, ctx);
                        if (child.type !== 6 /* TSet */) {
                            currentBlock.currentPath.push("nextSibling");
                        }
                    }
                    currentBlock.currentPath = path;
                    currentBlock.currentDom = initialDom;
                }
                break;
            }
            // -------------------------------------------------------------------------
            // t-esc
            // -------------------------------------------------------------------------
            case 4 /* TEsc */: {
                let expr;
                if (ast.expr === "0") {
                    expr = `ctx[zero]`;
                }
                else {
                    expr = compileExpr(ast.expr);
                    if (ast.defaultValue) {
                        expr = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
                    }
                }
                if (!currentBlock || forceNewBlock) {
                    if (currentBlock) {
                        ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = new TextBlock(${expr})`);
                    }
                    else {
                        const id = ctx.generateId("b");
                        ctx.addLine(`const ${id} = new TextBlock(${expr})`);
                        if (!ctx.rootBlock) {
                            ctx.rootBlock = id;
                        }
                    }
                }
                else {
                    const text = { type: 2 /* Node */, tag: "owl-text", attrs: {}, content: [] };
                    addToBlockDom(currentBlock, text);
                    const idx = currentBlock.textNumber;
                    currentBlock.textNumber++;
                    ctx.addLine(`${currentBlock.varName}.data[${idx}] = ${expr};`);
                    if (ast.expr === "0") {
                        updateBlockFn(currentBlock, (el) => `${el}.textContent = this.data[${idx}];`);
                    }
                    else {
                        updateBlockFn(currentBlock, (el) => `${el}.textContent = toString(this.data[${idx}]);`);
                    }
                }
                break;
            }
            // -------------------------------------------------------------------------
            // t-raw
            // -------------------------------------------------------------------------
            case 8 /* TRaw */: {
                if (!currentBlock) {
                    currentBlock = ctx.makeBlock({ multi: 1, parentBlock: null, parentIndex: currentIndex });
                }
                const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                addToBlockDom(currentBlock, anchor);
                currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
                currentBlock.childNumber++;
                let expr = ast.expr === "0" ? "ctx[zero]" : compileExpr(ast.expr);
                if (ast.body) {
                    const nextId = ctx.nextId;
                    compileAST({ type: 3 /* Multi */, content: ast.body }, null, 0, true, ctx);
                    expr = `withDefault(${expr}, b${nextId})`;
                }
                ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = new HTMLBlock(${expr});`);
                break;
            }
            // -------------------------------------------------------------------------
            // t-if
            // -------------------------------------------------------------------------
            case 5 /* TIf */: {
                if (!currentBlock) {
                    const n = 1 + (ast.tElif ? ast.tElif.length : 0) + (ast.tElse ? 1 : 0);
                    currentBlock = ctx.makeBlock({ multi: n, parentBlock: null, parentIndex: currentIndex });
                }
                ctx.addLine(`if (${compileExpr(ast.condition)}) {`);
                ctx.indentLevel++;
                const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                addToBlockDom(currentBlock, anchor);
                currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
                currentBlock.childNumber++;
                compileAST(ast.content, currentBlock, currentIndex, true, ctx);
                ctx.indentLevel--;
                if (ast.tElif) {
                    for (let clause of ast.tElif) {
                        ctx.addLine(`} else if (${compileExpr(clause.condition)}) {`);
                        ctx.indentLevel++;
                        const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                        addToBlockDom(currentBlock, anchor);
                        currentBlock.childNumber++;
                        compileAST(clause.content, currentBlock, currentBlock.childNumber - 1, true, ctx);
                        ctx.indentLevel--;
                    }
                }
                if (ast.tElse) {
                    ctx.addLine(`} else {`);
                    ctx.indentLevel++;
                    const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                    addToBlockDom(currentBlock, anchor);
                    currentBlock.childNumber++;
                    compileAST(ast.tElse, currentBlock, currentBlock.childNumber - 1, true, ctx);
                    ctx.indentLevel--;
                }
                ctx.addLine("}");
                break;
            }
            // -------------------------------------------------------------------------
            // t-foreach
            // -------------------------------------------------------------------------
            case 9 /* TForEach */: {
                const cId = ctx.generateId();
                const vals = `v${cId}`;
                const keys = `k${cId}`;
                const l = `l${cId}`;
                ctx.addLine(`const [${vals}, ${keys}, ${l}] = getValues(${compileExpr(ast.collection)});`);
                const id = ctx.generateId("b");
                if (currentBlock) {
                    const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                    addToBlockDom(currentBlock, anchor);
                    currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
                    currentBlock.childNumber++;
                    ctx.addLine(`const ${id} = ${currentBlock.varName}.children[${currentIndex}] = new CollectionBlock(${l});`);
                }
                else {
                    ctx.addLine(`const ${id} = new CollectionBlock(${l});`);
                    if (!ctx.rootBlock) {
                        ctx.rootBlock = id;
                    }
                }
                ctx.loopLevel++;
                const loopVar = `i${ctx.loopLevel}`;
                ctx.addLine(`ctx = Object.create(ctx);`);
                ctx.addLine(`for (let ${loopVar} = 0; ${loopVar} < ${l}; ${loopVar}++) {`);
                ctx.indentLevel++;
                ctx.addLine(`ctx[\`${ast.elem}\`] = ${vals}[${loopVar}];`);
                ctx.addLine(`ctx[\`${ast.elem}_first\`] = ${loopVar} === 0;`);
                ctx.addLine(`ctx[\`${ast.elem}_last\`] = ${loopVar} === ${vals}.length - 1;`);
                ctx.addLine(`ctx[\`${ast.elem}_index\`] = ${loopVar};`);
                ctx.addLine(`ctx[\`${ast.elem}_value\`] = ${keys}[${loopVar}];`);
                const collectionBlock = {
                    name: "Collection",
                    varName: id,
                    updateFn: [],
                    currentPath: [],
                    textNumber: 0,
                    childNumber: 0,
                };
                compileAST(ast.body, collectionBlock, loopVar, true, ctx);
                ctx.indentLevel--;
                ctx.addLine(`}`);
                ctx.loopLevel--;
                ctx.addLine(`ctx = ctx.__proto__;`);
                break;
            }
            // -------------------------------------------------------------------------
            // t-key
            // -------------------------------------------------------------------------
            case 10 /* TKey */: {
                const id = ctx.generateId("k");
                ctx.addLine(`const ${id} = ${compileExpr(ast.expr)};`);
                const currentKey = ctx.key;
                ctx.key = id;
                compileAST(ast.content, currentBlock, currentIndex, forceNewBlock, ctx);
                ctx.key = currentKey;
                break;
            }
            // -------------------------------------------------------------------------
            // multi block
            // -------------------------------------------------------------------------
            case 3 /* Multi */: {
                if (!currentBlock || forceNewBlock) {
                    const n = ast.content.filter((c) => c.type !== 6 /* TSet */).length;
                    if (n === 1) {
                        for (let child of ast.content) {
                            compileAST(child, currentBlock, currentIndex, forceNewBlock, ctx);
                        }
                        return;
                    }
                    currentBlock = ctx.makeBlock({
                        multi: n,
                        parentBlock: currentBlock ? currentBlock.varName : undefined,
                        parentIndex: currentIndex,
                    });
                }
                let index = 0;
                for (let i = 0; i < ast.content.length; i++) {
                    const child = ast.content[i];
                    const isTSet = child.type === 6 /* TSet */;
                    compileAST(child, currentBlock, index, !isTSet, ctx);
                    if (!isTSet) {
                        index++;
                    }
                }
                break;
            }
            // -------------------------------------------------------------------------
            // t-call
            // -------------------------------------------------------------------------
            case 7 /* TCall */: {
                if (ast.body) {
                    ctx.addLine(`ctx = Object.create(ctx);`);
                    // check if all content is t-set
                    const hasContent = ast.body.filter((elem) => elem.type !== 6 /* TSet */).length;
                    if (hasContent) {
                        const nextId = ctx.nextId;
                        compileAST({ type: 3 /* Multi */, content: ast.body }, null, 0, true, ctx);
                        ctx.addLine(`ctx[zero] = b${nextId};`);
                    }
                    else {
                        for (let elem of ast.body) {
                            compileAST(elem, currentBlock, 0, false, ctx);
                        }
                    }
                }
                const isDynamic = INTERP_REGEXP.test(ast.name);
                const subTemplate = isDynamic ? interpolate(ast.name) : "`" + ast.name + "`";
                if (currentBlock) {
                    if (!forceNewBlock) {
                        const anchor = { type: 2 /* Node */, tag: "owl-anchor", attrs: {}, content: [] };
                        addToBlockDom(currentBlock, anchor);
                        currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
                        currentBlock.childNumber++;
                    }
                    ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = call(${subTemplate}, ctx);`);
                }
                else {
                    const id = ctx.generateId("b");
                    ctx.rootBlock = id;
                    ctx.addLine(`const ${id} = call(${subTemplate}, ctx);`);
                }
                if (ast.body) {
                    ctx.addLine(`ctx = ctx.__proto__;`);
                }
                break;
            }
            // -------------------------------------------------------------------------
            // t-set/t-value
            // -------------------------------------------------------------------------
            case 6 /* TSet */: {
                ctx.shouldProtectScope = true;
                const expr = ast.value ? compileExpr(ast.value || "") : "null";
                if (ast.body) {
                    const nextId = ctx.nextId;
                    compileAST({ type: 3 /* Multi */, content: ast.body }, null, 0, true, ctx);
                    const value = ast.value ? `withDefault(${expr}, b${nextId})` : `b${nextId}`;
                    ctx.addLine(`ctx[\`${ast.name}\`] = ${value};`);
                }
                else {
                    let value;
                    if (ast.defaultValue) {
                        if (ast.value) {
                            value = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
                        }
                        else {
                            value = `\`${ast.defaultValue}\``;
                        }
                    }
                    else {
                        value = expr;
                    }
                    ctx.addLine(`ctx[\`${ast.name}\`] = ${value};`);
                }
                break;
            }
        }
    }
    // -----------------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------------
    function toDom(node) {
        switch (node.nodeType) {
            case 1: {
                // HTMLElement
                if (node.tagName === "owl-text") {
                    return document.createTextNode("");
                }
                const result = document.createElement(node.tagName);
                const attrs = node.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    result.setAttribute(attrs[i].name, attrs[i].value);
                }
                for (let child of node.childNodes) {
                    result.appendChild(toDom(child));
                }
                return result;
            }
            case 3: {
                // text node
                return document.createTextNode(node.textContent);
            }
            case 8: {
                // comment node
                return document.createComment(node.textContent);
            }
        }
        throw new Error("boom");
    }
    function elem(html) {
        const doc = new DOMParser().parseFromString(html, "text/xml");
        return toDom(doc.firstChild);
    }
    function toString(value) {
        switch (typeof value) {
            case "string":
                return value;
            case "number":
                return String(value);
            case "boolean":
                return value ? "true" : "false";
            case "undefined":
                return "";
            case "object":
                return value ? value.toString() : "";
        }
        throw new Error("not yet working" + value);
    }
    function withDefault(value, defaultValue) {
        return value === undefined || value === null || value === false ? defaultValue : value;
    }
    function call(name) {
        throw new Error(`Missing template: "${name}"`);
    }
    function getValues(collection) {
        if (Array.isArray(collection)) {
            return [collection, collection, collection.length];
        }
        else if (collection) {
            const keys = Object.keys(collection);
            return [keys, Object.values(collection), keys.length];
        }
        throw new Error("Invalid loop expression");
    }

    class Component {
        constructor() {
            this.__owl__ = null;
        }
        get el() {
            return this.__owl__.bdom.el;
        }
    }
    class FComponent extends Component {
        constructor(FC) {
            super();
            const value = FC.setup ? FC.setup() : null;
            if (value) {
                Object.assign(this, value);
            }
        }
    }
    let nextId = 1;
    const globalTemplates = new TemplateSet();
    function xml(strings, ...args) {
        const name = `__template__${nextId++}`;
        const value = String.raw(strings, ...args);
        globalTemplates.add(name, value);
        return name;
    }
    async function mount(C, params) {
        const { target } = params;
        let component;
        let template;
        if (C.prototype instanceof Component) {
            component = new C();
            template = C.template;
        }
        else {
            component = new FComponent(C);
            template = C.template;
        }
        const render = globalTemplates.getFunction(template).bind(null, component);
        const __owl__ = { render: render, bdom: null };
        component.__owl__ = __owl__;
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                const bdom = render();
                bdom.mount(target);
                __owl__.bdom = bdom;
                resolve(component);
            });
        });
    }

    /**
     * This file is the main file packaged by rollup (see rollup.config.js).  From
     * this file, we export all public owl elements.
     *
     * Note that dynamic values, such as a date or a commit hash are added by rollup
     */
    const __info__ = {};

    exports.Component = Component;
    exports.__info__ = __info__;
    exports.mount = mount;
    exports.xml = xml;


    __info__.version = '1.0.13';
    __info__.date = '2020-11-19T11:26:10.912Z';
    __info__.hash = 'c1891c5';
    __info__.url = 'https://github.com/odoo/owl';


}(this.owl = this.owl || {}));
