import { BDom, ContentBlock, HTMLBlock, MultiBlock } from "./bdom";
import { compileExpr } from "./expression_parser";
import { AST, ASTType, parse } from "./parser";

// -----------------------------------------------------------------------------
// Compile functions
// -----------------------------------------------------------------------------

const Blocks = { ContentBlock, MultiBlock, HTMLBlock };

export type RenderFunction = (context: any) => BDom;
export type TemplateFunction = (blocks: typeof Blocks, utils: typeof UTILS) => RenderFunction;

const UTILS = {
  elem,
  toString,
  withDefault,
  call: null,
  zero: Symbol("zero"),
};

export function compile(template: string, utils: typeof UTILS = UTILS): RenderFunction {
  const templateFunction = compileTemplate(template);
  return templateFunction(Blocks, utils);
}

export function compileTemplate(template: string): TemplateFunction {
  const ast = parse(template);
  // console.warn(ast);
  const ctx = new CompilationContext();
  compileAST(ast, null, 0, false, ctx);
  const code = ctx.generateCode();
  // console.warn(code);
  return new Function("Blocks, utils", code) as TemplateFunction;
}

export class TemplateSet {
  templates: { [name: string]: string } = {};
  compiledTemplates: { [name: string]: RenderFunction } = {};
  utils: typeof UTILS;

  constructor() {
    const call = (subTemplate: string, ctx: any) => {
      const renderFn = this.getFunction(subTemplate);
      return renderFn(ctx);
    };

    this.utils = Object.assign({}, UTILS, { call });
  }

  add(name: string, template: string) {
    this.templates[name] = template;
  }

  getFunction(name: string): RenderFunction {
    if (!(name in this.compiledTemplates)) {
      const templateFn = compileTemplate(this.templates[name]);
      const renderFn = templateFn(Blocks, this.utils);
      this.compiledTemplates[name] = renderFn;
    }
    return this.compiledTemplates[name];
  }
}

// -----------------------------------------------------------------------------
// Compilation Context
// -----------------------------------------------------------------------------

interface BlockDescription {
  name: string;
  updateFn: string[];
  varName: string;
  currentPath: string[];
  textNumber: number;
  dom?: Dom;
  currentDom?: DomNode;
  childNumber: number;
}

const enum DomType {
  Text,
  Comment,
  Node,
}

interface DomText {
  type: DomType.Text;
  value: string;
}

interface DomComment {
  type: DomType.Comment;
  value: string;
}
interface DomNode {
  type: DomType.Node;
  tag: string;
  attrs: { [key: string]: string };
  content: Dom[];
}

type Dom = DomText | DomComment | DomNode;

interface MakeBlockParams {
  multi?: number;
  parentBlock?: string | null;
  parentIndex?: number | null;
}

class CompilationContext {
  code: string[] = [];
  indentLevel: number = 0;
  blocks: BlockDescription[] = [];
  rootBlock: string | null = null;
  nextId = 1;
  shouldProtextScope: boolean = false;

  addLine(line: string) {
    const prefix = new Array(this.indentLevel + 2).join("  ");
    this.code.push(prefix + line);
  }

  generateId(prefix: string = ""): string {
    return `${prefix}${this.nextId++}`;
  }

  makeBlock({ multi, parentBlock, parentIndex }: MakeBlockParams = {}): BlockDescription {
    const name = multi ? "MultiBlock" : `Block${this.blocks.length + 1}`;
    const block: BlockDescription = {
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

  generateCode(): string {
    const mainCode = this.code;
    this.code = [];
    this.indentLevel = 0;
    // define blocks and utility functions
    this.addLine(`let {MultiBlock, ContentBlock, HTMLBlock} = Blocks;`);
    this.addLine(`let {elem, toString, withDefault, call, zero} = utils;`);
    this.addLine(``);

    // define all blocks
    for (let block of this.blocks) {
      this.addLine(`class ${block.name} extends ContentBlock {`);
      this.indentLevel++;
      this.addLine(`static el = elem(\`${domToString(block.dom!)}\`);`);
      if (block.childNumber) {
        this.addLine(`children = new Array(${block.childNumber});`);
      }
      if (block.textNumber) {
        this.addLine(`texts = new Array(${block.textNumber});`);
      }
      if (block.updateFn.length) {
        this.addLine(`update() {`);
        this.indentLevel++;
        for (let line of block.updateFn) {
          this.addLine(line);
        }
        this.indentLevel--;
        this.addLine(`}`);
      }
      this.indentLevel--;
      this.addLine(`}`);
    }

    // generate main code
    this.indentLevel = 0;
    this.addLine(``);
    this.addLine(`return ctx => {`);
    if (this.shouldProtextScope) {
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
function domToString(dom: Dom): string {
  switch (dom.type) {
    case DomType.Text:
      return dom.value;
    case DomType.Comment:
      return `<!--${dom.value}-->`;
    case DomType.Node:
      const content = dom.content.map(domToString).join("");
      const attrs: string[] = [];
      for (let [key, value] of Object.entries(dom.attrs)) {
        if (!(key === "class" && value === "")) {
          attrs.push(`${key}="${value}"`);
        }
      }
      return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}>${content}</${dom.tag}>`;
  }
}

function addToBlockDom(block: BlockDescription, dom: Dom) {
  if (block.currentDom) {
    block.currentDom.content.push(dom);
  } else {
    block.dom = dom;
  }
}

function compileAST(
  ast: AST,
  currentBlock: BlockDescription | null,
  currentIndex: number,
  forceNewBlock: boolean,
  ctx: CompilationContext
) {
  if (ast.type === ASTType.TSet) {
    ctx.shouldProtextScope = true;
    const expr = ast.value ? compileExpr(ast.value || "", {}) : "null";
    if (ast.body) {
      const nextId = ctx.nextId;
      compileAST({ type: ASTType.Multi, content: ast.body }, null, 0, true, ctx);
      const value = ast.value ? `withDefault(${expr}, b${nextId})` : `b${nextId}`;
      ctx.addLine(`ctx[\`${ast.name}\`] = ${value};`);
    } else {
      let value: string;
      if (ast.defaultValue) {
        if (ast.value) {
          value = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
        } else {
          value = `\`${ast.defaultValue}\``;
        }
      } else {
        value = expr;
      }
      ctx.addLine(`ctx[\`${ast.name}\`] = ${value};`);
    }
    return;
  }

  if (!currentBlock || forceNewBlock) {
    switch (ast.type) {
      case ASTType.TIf:
        if (!currentBlock) {
          const n = 1 + (ast.tElif ? ast.tElif.length : 0) + (ast.tElse ? 1 : 0);
          currentBlock = ctx.makeBlock({ multi: n, parentBlock: null, parentIndex: currentIndex });
        }
        break;
      case ASTType.TRaw:
      case ASTType.TCall:
        if (!currentBlock) {
          currentBlock = ctx.makeBlock({ multi: 1, parentBlock: null, parentIndex: currentIndex });
        }
        break;
      case ASTType.Multi:
        const n = ast.content.filter((c) => c.type !== ASTType.TSet).length;
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
        break;
      default:
        currentBlock = ctx.makeBlock({
          parentIndex: currentIndex,
          parentBlock: currentBlock ? currentBlock.varName : undefined,
        });
    }
  }
  switch (ast.type) {
    case ASTType.Comment:
    case ASTType.Text: {
      const type = ast.type === ASTType.Text ? DomType.Text : DomType.Comment;
      const text: Dom = { type, value: ast.value };
      addToBlockDom(currentBlock, text);
      break;
    }
    case ASTType.DomNode: {
      const dom: Dom = { type: DomType.Node, tag: ast.tag, attrs: ast.attrs, content: [] };
      addToBlockDom(currentBlock, dom);
      if (ast.content.length) {
        const initialDom = currentBlock.currentDom;
        currentBlock.currentDom = dom;
        const path = currentBlock.currentPath.slice();
        currentBlock.currentPath.push("firstChild");
        for (let child of ast.content) {
          compileAST(child, currentBlock, currentBlock.childNumber, false, ctx);
          if (child.type !== ASTType.TSet) {
            currentBlock.currentPath.push("nextSibling");
          }
        }
        currentBlock.currentPath = path;
        currentBlock.currentDom = initialDom;
      }
      break;
    }
    case ASTType.TEsc: {
      const targetEl = `this.` + currentBlock.currentPath.join(".");
      const text: Dom = { type: DomType.Node, tag: "owl-text", attrs: {}, content: [] };
      addToBlockDom(currentBlock, text);
      const idx = currentBlock.textNumber;
      currentBlock.textNumber++;
      if (ast.expr === "0") {
        ctx.addLine(`${currentBlock.varName}.texts[${idx}] = ctx[zero];`);
        currentBlock.updateFn.push(`${targetEl}.textContent = this.texts[${idx}];`);
      } else {
        const expr = compileExpr(ast.expr, {});
        const textValue = ast.defaultValue ? `withDefault(${expr}, \`${ast.defaultValue}\`)` : expr;
        ctx.addLine(`${currentBlock.varName}.texts[${idx}] = ${textValue};`);
        currentBlock.updateFn.push(`${targetEl}.textContent = toString(this.texts[${idx}]);`);
      }
      break;
    }
    case ASTType.TRaw: {
      const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
      addToBlockDom(currentBlock, anchor);
      currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
      currentBlock.childNumber++;
      const expr = compileExpr(ast.expr, {});
      ctx.addLine(
        `${currentBlock.varName}.children[${
          currentBlock.childNumber - 1
        }] = new HTMLBlock(${expr});`
      );
      break;
    }

    case ASTType.TIf: {
      ctx.addLine(`if (${compileExpr(ast.condition, {})}) {`);
      ctx.indentLevel++;
      const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
      addToBlockDom(currentBlock, anchor);
      currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
      currentBlock.childNumber++;
      compileAST(ast.content, currentBlock, currentIndex, true, ctx);
      ctx.indentLevel--;
      if (ast.tElif) {
        for (let clause of ast.tElif) {
          ctx.addLine(`} else if (${compileExpr(clause.condition, {})}) {`);
          ctx.indentLevel++;
          const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
          addToBlockDom(currentBlock, anchor);
          currentBlock.childNumber++;
          compileAST(clause.content, currentBlock, currentBlock.childNumber - 1, true, ctx);
          ctx.indentLevel--;
        }
      }
      if (ast.tElse) {
        ctx.addLine(`} else {`);
        ctx.indentLevel++;
        const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
        addToBlockDom(currentBlock, anchor);
        currentBlock.childNumber++;
        compileAST(ast.tElse, currentBlock, currentBlock.childNumber - 1, true, ctx);

        ctx.indentLevel--;
      }
      ctx.addLine("}");
      break;
    }
    case ASTType.Multi: {
      let index = 0;
      for (let i = 0; i < ast.content.length; i++) {
        const child = ast.content[i];
        const isTSet = child.type === ASTType.TSet;
        compileAST(child, currentBlock, index, !isTSet, ctx);
        if (!isTSet) {
          index++;
        }
      }
      break;
    }

    case ASTType.TCall: {
      if (ast.body) {
        const nextId = ctx.nextId;
        compileAST({ type: ASTType.Multi, content: ast.body }, null, 0, true, ctx);
        ctx.addLine(`ctx[zero] = b${nextId};`);
      }

      const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
      addToBlockDom(currentBlock, anchor);
      currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
      currentBlock.childNumber++;

      ctx.addLine(
        `${currentBlock.varName}.children[${currentBlock.childNumber - 1}] = call(\`${
          ast.name
        }\`, ctx);`
      );
      break;
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function elem(html: string): HTMLElement | Text {
  const div = document.createElement("div");
  div.innerHTML = html;
  // replace all "owl-text" by text nodes
  const texts = div.getElementsByTagName("owl-text");
  while (texts.length) {
    texts[0].replaceWith(document.createTextNode(""));
  }
  return (div.firstChild as HTMLElement | Text) || document.createTextNode("");
}

function toString(value: any): string {
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

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}
