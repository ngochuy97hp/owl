// -----------------------------------------------------------------------------
// AST Type definition
// -----------------------------------------------------------------------------

export const enum ASTType {
  Text,
  Comment,
  DomNode,
  Multi,
  TEsc,
  TIf,
  TSet,
  TCall,
  TRaw,
  TForEach,
  TKey,
}

export interface ASTText {
  type: ASTType.Text;
  value: string;
}

export interface ASTComment {
  type: ASTType.Comment;
  value: string;
}

export interface ASTDomNode {
  type: ASTType.DomNode;
  tag: string;
  attrs: { [key: string]: string };
  content: AST[];
}

export interface ASTMulti {
  type: ASTType.Multi;
  content: AST[];
}

export interface ASTTEsc {
  type: ASTType.TEsc;
  expr: string;
  defaultValue: string;
}

export interface ASTTRaw {
  type: ASTType.TRaw;
  expr: string;
}

export interface ASTTif {
  type: ASTType.TIf;
  condition: string;
  content: AST;
  tElif: { condition: string; content: AST }[] | null;
  tElse: AST | null;
}

export interface ASTTSet {
  type: ASTType.TSet;
  name: string;
  value: string | null; // value defined in attribute
  defaultValue: string | null; // value defined in body, if text
  body: AST[] | null; // content of body if not text
}

export interface ASTTForEach {
  type: ASTType.TForEach;
  collection: string;
  elem: string;
  body: AST;
}

export interface ASTTKey {
  type: ASTType.TKey;
  expr: string;
  content: AST;
}

export interface ASTTCall {
  type: ASTType.TCall;
  name: string;
  body: AST[] | null;
}

export type AST =
  | ASTText
  | ASTComment
  | ASTDomNode
  | ASTMulti
  | ASTTEsc
  | ASTTif
  | ASTTSet
  | ASTTCall
  | ASTTRaw
  | ASTTForEach
  | ASTTKey;

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------
interface ParsingContext {
  inPreTag: boolean;
}

export function parse(xml: string): AST {
  const template = `<t>${xml}</t>`;
  const doc = parseXML(template);
  const ctx = { inPreTag: false };
  const ast = parseNode(doc.firstChild!, ctx);
  if (!ast) {
    return { type: ASTType.Text, value: "" };
  }
  return ast;
}

function parseNode(node: ChildNode, ctx: ParsingContext): AST | null {
  if (!(node instanceof Element)) {
    return parseTextCommentNode(node, ctx);
  }
  return (
    parseTIf(node, ctx) ||
    parseTEscNode(node, ctx) ||
    parseTCall(node, ctx) ||
    parseTForEach(node, ctx) ||
    parseTKey(node, ctx) ||
    parseDOMNode(node, ctx) ||
    parseTSetNode(node, ctx) ||
    parseTRawNode(node, ctx) ||
    parseTNode(node, ctx)
  );
}

// -----------------------------------------------------------------------------
// <t /> tag
// -----------------------------------------------------------------------------

function parseTNode(node: Element, ctx: ParsingContext): AST | null {
  if (node.tagName !== "t") {
    return null;
  }
  const children: AST[] = [];
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
        type: ASTType.Multi,
        content: children,
      };
  }
}

// -----------------------------------------------------------------------------
// Text and Comment Nodes
// -----------------------------------------------------------------------------
const lineBreakRE = /[\r\n]/;
const whitespaceRE = /\s+/g;

function parseTextCommentNode(node: ChildNode, ctx: ParsingContext): AST | null {
  if (node.nodeType === 3) {
    let value = node.textContent || "";
    if (!ctx.inPreTag) {
      if (lineBreakRE.test(value) && !value.trim()) {
        return null;
      }
      value = value.replace(whitespaceRE, " ");
    }

    return { type: ASTType.Text, value };
  } else if (node.nodeType === 8) {
    return { type: ASTType.Comment, value: node.textContent || "" };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Regular dom node
// -----------------------------------------------------------------------------

function parseDOMNode(node: Element, ctx: ParsingContext): AST | null {
  if (node.tagName === "t") {
    return null;
  }
  const children: AST[] = [];
  if (node.tagName === "pre") {
    ctx = { inPreTag: true };
  }
  for (let child of node.childNodes) {
    const ast = parseNode(child, ctx);
    if (ast) {
      children.push(ast);
    }
  }
  if (node.tagName === "pre" && children[0].type === ASTType.Text) {
    // weird fix: because owl will serialize this value, and deserialize it
    // later, the leading \n character will be dropped, as per the html spec
    // therefore we need to add an extra \n to get the expected result
    children[0].value = `\n` + children[0].value;
  }

  const attrs: ASTDomNode["attrs"] = {};
  for (let attr of node.getAttributeNames()) {
    attrs[attr] = node.getAttribute(attr)!;
  }
  return {
    type: ASTType.DomNode,
    tag: node.tagName,
    attrs,
    content: children,
  };
}

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

function parseTEscNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-esc")) {
    return null;
  }
  const escValue = node.getAttribute("t-esc")!;
  node.removeAttribute("t-esc");
  const tesc: AST = {
    type: ASTType.TEsc,
    expr: escValue,
    defaultValue: node.textContent || "",
  };
  const ast = parseNode(node, ctx);
  if (!ast) {
    return tesc;
  }
  if (ast && ast.type === ASTType.DomNode) {
    return {
      type: ASTType.DomNode,
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

function parseTRawNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-raw")) {
    return null;
  }
  const expr = node.getAttribute("t-raw")!;
  return { type: ASTType.TRaw, expr };
}

// -----------------------------------------------------------------------------
// t-foreach and t-key
// -----------------------------------------------------------------------------

function parseTForEach(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-foreach")) {
    return null;
  }
  const collection = node.getAttribute("t-foreach")!;
  node.removeAttribute("t-foreach");
  const elem = node.getAttribute("t-as") || "";
  node.removeAttribute("t-as");
  const body = parseNode(node, ctx);
  if (!body) {
    return null;
  }
  return {
    type: ASTType.TForEach,
    collection,
    elem,
    body,
  };
}

function parseTKey(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-key")) {
    return null;
  }
  const key = node.getAttribute("t-key")!;
  node.removeAttribute("t-key");
  const body = parseNode(node, ctx);
  if (!body) {
    return null;
  }
  return { type: ASTType.TKey, expr: key, content: body };
}

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

function parseTCall(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-call")) {
    return null;
  }
  const subTemplate = node.getAttribute("t-call")!;

  node.removeAttribute("t-call");
  if (node.tagName !== "t") {
    const ast = parseNode(node, ctx);
    if (ast && ast.type === ASTType.DomNode) {
      ast.content = [{ type: ASTType.TCall, name: subTemplate, body: null }];
      return ast;
    }
  }
  const body: AST[] = [];
  for (let child of node.childNodes) {
    const ast = parseNode(child, ctx);
    if (ast) {
      body.push(ast);
    }
  }

  return {
    type: ASTType.TCall,
    name: subTemplate,
    body: body.length ? body : null,
  };
}

// -----------------------------------------------------------------------------
// t-if
// -----------------------------------------------------------------------------

function parseTIf(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-if")) {
    return null;
  }
  const condition = node.getAttribute("t-if")!;
  node.removeAttribute("t-if");
  const content = parseNode(node, ctx);
  if (!content) {
    throw new Error("hmmm");
  }

  let nextElement = node.nextElementSibling;
  // t-elifs
  const tElifs: any[] = [];
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
  let tElse: AST | null = null;
  if (nextElement && nextElement.hasAttribute("t-else")) {
    nextElement.removeAttribute("t-else");
    tElse = parseNode(nextElement, ctx);
    nextElement.remove();
  }

  return {
    type: ASTType.TIf,
    condition,
    content,
    tElif: tElifs.length ? tElifs : null,
    tElse,
  };
}

// -----------------------------------------------------------------------------
// t-set directive
// -----------------------------------------------------------------------------

function parseTSetNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-set")) {
    return null;
  }
  const name = node.getAttribute("t-set")!;
  const value = node.getAttribute("t-value") || null;
  const defaultValue = node.innerHTML === node.textContent ? node.textContent || null : null;
  let body: AST[] | null = null;
  if (node.textContent !== node.innerHTML) {
    body = [];
    for (let child of node.childNodes) {
      let childAst = parseNode(child, ctx);
      if (childAst) {
        body.push(childAst);
      }
    }
  }
  return { type: ASTType.TSet, name, value, defaultValue, body };
}

// -----------------------------------------------------------------------------
// parse XML
// -----------------------------------------------------------------------------

function parseXML(xml: string): Document {
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
    let prevElem = node.previousElementSibling!;
    let pattr = (name: string) => prevElem.getAttribute(name);
    let nattr = (name: string) => +!!node.getAttribute(name);
    if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
      if (pattr("t-foreach")) {
        throw new Error(
          "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
        );
      }
      if (
        ["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
          return a + b;
        }) > 1
      ) {
        throw new Error("Only one conditional branching directive is allowed per node");
      }
      // All text (with only spaces) and comment nodes (nodeType 8) between
      // branch nodes are removed
      let textNode;
      while ((textNode = node.previousSibling) !== prevElem) {
        if (textNode!.nodeValue!.trim().length && textNode!.nodeType !== 8) {
          throw new Error("text is not allowed between branching directives");
        }
        textNode!.remove();
      }
    } else {
      throw new Error(
        "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
      );
    }
  }

  return doc;
}

// import { compileExpr } from "./expression_parser";

// export interface ASTDOMNode {
//   type: "DOM";
//   tag: string;
//   children: AST[];
//   key: string | number;
//   attrs: { [name: string]: string };
// }

// export interface ASTComponentNode {
//   type: "COMPONENT";
//   name: string;
// }

// export interface ASTEscNode {
//   type: "T-ESC";
//   expr: string;
//   body: AST[];
// }

// export interface ASTRawNode {
//   type: "T-RAW";
//   expr: string;
//   body: AST[];
// }

// export interface ASTCommentNode {
//   type: "COMMENT";
//   text: string;
// }

// export interface ASTMultiNode {
//   type: "MULTI";
//   children: AST[];
// }

// export interface ASTIfNode {
//   type: "T-IF";
//   condition: string;
//   child: AST;
//   next: ASTElifNode | ASTElseNode | null;
// }

// export interface ASTElifNode {
//   type: "T-ELIF";
//   condition: string;
//   child: AST;
//   next: ASTElifNode | ASTElseNode | null;
// }

// export interface ASTElseNode {
//   type: "T-ELSE";
//   child: AST;
// }

// export interface ASTSetNode {
//   type: "T-SET";
//   name: string;
//   value: string | null;
//   body: AST[];
// }

// export interface ASTForeachNode {
//   type: "T-FOREACH";
//   collection: string;
//   varName: string;
//   children: AST[];
// }

// export interface ASTCallNode {
//   type: "T-CALL";
//   template: string;
//   children: AST[];
// }

// export type AST =
//   | ASTDOMNode
//   | ASTTextNode
//   | ASTEscNode
//   | ASTRawNode
//   | ASTSetNode
//   | ASTCommentNode
//   | ASTMultiNode
//   | ASTIfNode
//   | ASTElifNode
//   | ASTElseNode
//   | ASTComponentNode
//   | ASTForeachNode
//   | ASTCallNode;

// // -----------------------------------------------------------------------------
// // Parser
// // -----------------------------------------------------------------------------

// export function parse(xml: string): AST {
//   const template = `<t>${xml}</t>`;
//   const doc = parseXML(template);
//   return parseNode(doc.firstChild!)!;
// }

// function parseNode(node: ChildNode): AST | null {
//   if (!(node instanceof Element)) {
//     return parseTextCommentNode(node);
//   }
//   return (
//     parseTIfNode(node) ||
//     parseTEscNode(node) ||
//     parseTRawNode(node) ||
//     parseComponentNode(node) ||
//     parseTSetNode(node) ||
//     parseTCallNode(node) ||
//     parseTForeachNode(node) ||
//     parseTNode(node) ||
//     parseDOMNode(node)
//   );
// }

// // -----------------------------------------------------------------------------
// // Text and Comment Nodes
// // -----------------------------------------------------------------------------
// const lineBreakRE = /[\r\n]/;
// const whitespaceRE = /\s+/g;

// function parseTextCommentNode(node: ChildNode): AST | null {
//   const type = node.nodeType === 3 ? "TEXT" : "COMMENT";
//   let text = node.textContent!;
//   if (lineBreakRE.test(text) && !text.trim()) {
//     return null;
//   }
//   text = text.replace(whitespaceRE, " ");
//   return {
//     type,
//     text: "`" + text + "`",
//   };
// }

// // -----------------------------------------------------------------------------
// // t-if directive
// // -----------------------------------------------------------------------------

// function parseTIfNode(node: Element): ASTIfNode | null {
//   if (!node.hasAttribute("t-if")) {
//     return null;
//   }

//   const condition = node.getAttribute("t-if")!;
//   node.removeAttribute("t-if");
//   let child = parseNode(node)!;

//   let nextElement = node.nextElementSibling;
//   let firstAST: null | ASTElifNode | ASTElseNode = null;
//   let lastAST: null | ASTElifNode | ASTElseNode = null;

//   // t-elifs
//   while (nextElement && nextElement.hasAttribute("t-elif")) {
//     const condition = nextElement.getAttribute("t-elif")!;
//     nextElement.removeAttribute("t-elif");
//     const elif: ASTElifNode = {
//       type: "T-ELIF",
//       child: parseNode(nextElement)!,
//       condition,
//       next: null,
//     };
//     firstAST = firstAST || elif;
//     if (lastAST) {
//       lastAST.next = elif;
//       lastAST = elif;
//     } else {
//       lastAST = elif;
//     }
//     const n = nextElement.nextElementSibling;
//     nextElement.remove();
//     nextElement = n;
//   }

//   // t-else
//   if (nextElement && nextElement.hasAttribute("t-else")) {
//     const elseAST: ASTElseNode = {
//       type: "T-ELSE",
//       child: parseNode(nextElement)!,
//     };
//     firstAST = firstAST || elseAST;
//     if (lastAST) {
//       lastAST.next = elseAST;
//     }
//     nextElement.remove();
//   }

//   return {
//     type: "T-IF",
//     child,
//     condition,
//     next: firstAST,
//   };
// }

// // -----------------------------------------------------------------------------
// // t-esc and t-raw directive
// // -----------------------------------------------------------------------------

// function parseTEscNode(node: Element): AST | null {
//   return parseTEscRawNode(node, "t-esc");
// }

// function parseTRawNode(node: Element): AST | null {
//   return parseTEscRawNode(node, "t-raw");
// }

// function parseTEscRawNode(node: Element, attr: "t-esc" | "t-raw"): AST | null {
//   if (!node.hasAttribute(attr)) {
//     return null;
//   }
//   const type = attr === "t-esc" ? "T-ESC" : "T-RAW";
//   const expr = node.getAttribute(attr)!;
//   node.removeAttribute(attr);
//   const ast = parseNode(node);
//   if (ast && ast.type === "DOM") {
//     const body = ast.children;
//     ast.children = [{ type, expr, body }];
//     return ast;
//   }
//   if (ast && ast.type === "MULTI") {
//     return { type, expr, body: ast.children };
//   }
//   return { type, expr, body: ast ? [ast] : [] };
// }

// // -----------------------------------------------------------------------------
// // Components: <t t-component /> and <Component />
// // -----------------------------------------------------------------------------

// function parseComponentNode(node: Element): AST | null {
//   const firstLetter = node.tagName[0];
//   if (firstLetter !== firstLetter.toUpperCase()) {
//     return null;
//   }
//   return {
//     type: "COMPONENT",
//     name: node.tagName,
//   };
// }

// // -----------------------------------------------------------------------------
// // t-set directive
// // -----------------------------------------------------------------------------

// function parseTSetNode(node: Element): AST | null {
//   if (!node.hasAttribute("t-set")) {
//     return null;
//   }
//   const name = node.getAttribute("t-set")!;
//   const value = node.getAttribute("t-value");
//   const body = parseChildren(node);
//   return { type: "T-SET", name, value, body };
// }

// // -----------------------------------------------------------------------------
// // Regular dom node
// // -----------------------------------------------------------------------------

// function parseDOMNode(node: Element): ASTDOMNode {
//   const keyExpr = node.getAttribute("t-key");
//   const key = keyExpr ? compileExpr(keyExpr, {}) : "1";
//   node.removeAttribute("t-key");
//   const attributes = (<Element>node).attributes;
//   const attrs: { [name: string]: string } = {};
//   for (let i = 0; i < attributes.length; i++) {
//     let attrName = attributes[i].name;
//     let attrValue = attributes[i].textContent;
//     if (attrValue) {
//       attrs[attrName] = attrValue;
//     }
//   }
//   return {
//     type: "DOM",
//     tag: node.tagName,
//     children: parseChildren(node),
//     key,
//     attrs,
//   };
// }

// // -----------------------------------------------------------------------------
// // parse XML
// // -----------------------------------------------------------------------------

// function parseXML(xml: string): Document {
//   const parser = new DOMParser();

//   const doc = parser.parseFromString(xml, "text/xml");
//   if (doc.getElementsByTagName("parsererror").length) {
//     let msg = "Invalid XML in template.";
//     const parsererrorText = doc.getElementsByTagName("parsererror")[0].textContent;
//     if (parsererrorText) {
//       msg += "\nThe parser has produced the following error message:\n" + parsererrorText;
//       const re = /\d+/g;
//       const firstMatch = re.exec(parsererrorText);
//       if (firstMatch) {
//         const lineNumber = Number(firstMatch[0]);
//         const line = xml.split("\n")[lineNumber - 1];
//         const secondMatch = re.exec(parsererrorText);
//         if (line && secondMatch) {
//           const columnIndex = Number(secondMatch[0]) - 1;
//           if (line[columnIndex]) {
//             msg +=
//               `\nThe error might be located at xml line ${lineNumber} column ${columnIndex}\n` +
//               `${line}\n${"-".repeat(columnIndex - 1)}^`;
//           }
//         }
//       }
//     }
//     throw new Error(msg);
//   }
//   let tbranch = doc.querySelectorAll("[t-elif], [t-else]");
//   for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
//     let node = tbranch[i];
//     let prevElem = node.previousElementSibling!;
//     let pattr = function (name) {
//       return prevElem.getAttribute(name);
//     };
//     let nattr = function (name) {
//       return +!!node.getAttribute(name);
//     };
//     if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
//       if (pattr("t-foreach")) {
//         throw new Error(
//           "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
//         );
//       }
//       if (
//         ["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
//           return a + b;
//         }) > 1
//       ) {
//         throw new Error("Only one conditional branching directive is allowed per node");
//       }
//       // All text (with only spaces) and comment nodes (nodeType 8) between
//       // branch nodes are removed
//       let textNode;
//       while ((textNode = node.previousSibling) !== prevElem) {
//         if (textNode.nodeValue.trim().length && textNode.nodeType !== 8) {
//           throw new Error("text is not allowed between branching directives");
//         }
//         textNode.remove();
//       }
//     } else {
//       throw new Error(
//         "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
//       );
//     }
//   }

//   return doc;
// }

// // -----------------------------------------------------------------------------
// // t-call directive
// // -----------------------------------------------------------------------------

// function parseTCallNode(node: Element): AST | null {
//   if (!node.hasAttribute("t-call")) {
//     return null;
//   }
//   if (node.tagName !== "t") {
//     throw new Error("Invalid tag for t-call directive (should be 't')");
//   }

//   return {
//     type: "T-CALL",
//     template: node.getAttribute("t-call")!,
//     children: parseChildren(node),
//   };
// }

// // -----------------------------------------------------------------------------
// // t-foreach directive
// // -----------------------------------------------------------------------------

// function parseTForeachNode(node: Element): AST | null {
//   if (!node.hasAttribute("t-foreach")) {
//     return null;
//   }
//   const collection = node.getAttribute("t-foreach")!;
//   const varName = node.getAttribute("t-as")!;
//   node.removeAttribute("t-foreach");
//   node.removeAttribute("t-as");
//   const children = node.tagName === "t" ? parseChildren(node) : [parseDOMNode(node)];
//   return {
//     type: "T-FOREACH",
//     children,
//     collection,
//     varName,
//   };
// }
