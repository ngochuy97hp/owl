import { BDom, ContentBlock, HTMLBlock, MultiBlock, CollectionBlock, TextBlock } from "./bdom";
import { compileExpr } from "./expression_parser";
import { AST, ASTType, parse } from "./parser";

// -----------------------------------------------------------------------------
// Compile functions
// -----------------------------------------------------------------------------

const Blocks = { ContentBlock, MultiBlock, HTMLBlock, CollectionBlock, TextBlock };

export type RenderFunction = (context: any) => BDom;
export type TemplateFunction = (blocks: typeof Blocks, utils: typeof UTILS) => RenderFunction;

const UTILS = {
  elem,
  toString,
  withDefault,
  call,
  zero: Symbol("zero"),
  getValues,
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
  parentIndex?: number | string | null;
}

class CompilationContext {
  code: string[] = [];
  indentLevel: number = 0;
  blocks: BlockDescription[] = [];
  rootBlock: string | null = null;
  nextId = 1;
  shouldProtextScope: boolean = false;
  key: string | null = null;

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

    // micro optimization: remove trailing ctx = ctx.__proto__;
    if (mainCode[mainCode.length - 1] === `  ctx = ctx.__proto__;`) {
      mainCode = mainCode.slice(0, -1);
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
  currentIndex: number | string,
  forceNewBlock: boolean,
  ctx: CompilationContext
) {
  switch (ast.type) {
    // -------------------------------------------------------------------------
    // Comment/Text
    // -------------------------------------------------------------------------
    case ASTType.Comment: {
      if (!currentBlock || forceNewBlock) {
        currentBlock = ctx.makeBlock({
          parentIndex: currentIndex,
          parentBlock: currentBlock ? currentBlock.varName : undefined,
        });
      }
      const text: Dom = { type: DomType.Comment, value: ast.value };
      addToBlockDom(currentBlock, text);
      break;
    }
    case ASTType.Text: {
      if (!currentBlock || forceNewBlock) {
        if (currentBlock) {
          ctx.addLine(
            `${currentBlock.varName}.children[${currentIndex}] = new TextBlock(\`${ast.value}\`)`
          );
        } else {
          const id = ctx.generateId("b");
          ctx.addLine(`const ${id} = new TextBlock(\`${ast.value}\`)`);
          if (!ctx.rootBlock) {
            ctx.rootBlock = id;
          }
        }
      } else {
        const type = ast.type === ASTType.Text ? DomType.Text : DomType.Comment;
        const text: Dom = { type, value: ast.value };
        addToBlockDom(currentBlock, text);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // Dom Node
    // -------------------------------------------------------------------------
    case ASTType.DomNode: {
      if (!currentBlock || forceNewBlock) {
        currentBlock = ctx.makeBlock({
          parentIndex: currentIndex,
          parentBlock: currentBlock ? currentBlock.varName : undefined,
        });
      }
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

    // -------------------------------------------------------------------------
    // t-esc
    // -------------------------------------------------------------------------
    case ASTType.TEsc: {
      if (!currentBlock || forceNewBlock) {
        let expr: string;
        if (ast.expr === "0") {
          expr = `ctx[zero]`;
        } else {
          expr = compileExpr(ast.expr, {});
          if (ast.defaultValue) {
            expr = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
          }
        }
        if (currentBlock) {
          ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = new TextBlock(${expr})`);
        } else {
          const id = ctx.generateId("b");
          ctx.addLine(`const ${id} = new TextBlock(${expr})`);
          if (!ctx.rootBlock) {
            ctx.rootBlock = id;
          }
        }
      } else {
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
          const textValue = ast.defaultValue
            ? `withDefault(${expr}, \`${ast.defaultValue}\`)`
            : expr;
          ctx.addLine(`${currentBlock.varName}.texts[${idx}] = ${textValue};`);
          currentBlock.updateFn.push(`${targetEl}.textContent = toString(this.texts[${idx}]);`);
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // t-raw
    // -------------------------------------------------------------------------
    case ASTType.TRaw: {
      if (!currentBlock) {
        currentBlock = ctx.makeBlock({ multi: 1, parentBlock: null, parentIndex: currentIndex });
      }
      const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
      addToBlockDom(currentBlock, anchor);
      currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
      currentBlock.childNumber++;
      const expr = ast.expr === "0" ? "ctx[zero]" : compileExpr(ast.expr, {});
      ctx.addLine(`${currentBlock.varName}.children[${currentIndex}] = new HTMLBlock(${expr});`);
      break;
    }

    // -------------------------------------------------------------------------
    // t-if
    // -------------------------------------------------------------------------
    case ASTType.TIf: {
      if (!currentBlock) {
        const n = 1 + (ast.tElif ? ast.tElif.length : 0) + (ast.tElse ? 1 : 0);
        currentBlock = ctx.makeBlock({ multi: n, parentBlock: null, parentIndex: currentIndex });
      }
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

    // -------------------------------------------------------------------------
    // t-foreach
    // -------------------------------------------------------------------------

    case ASTType.TForEach: {
      ctx.shouldProtextScope = true;

      const cId = ctx.generateId();
      const vals = `v${cId}`;
      const keys = `k${cId}`;
      const l = `l${cId}`;
      ctx.addLine(
        `const [${vals}, ${keys}, ${l}] = getValues(${compileExpr(ast.collection, {})});`
      );

      const id = ctx.generateId("b");

      if (currentBlock) {
        const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
        addToBlockDom(currentBlock, anchor);
        currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
        currentBlock.childNumber++;

        ctx.addLine(
          `const ${id} = ${currentBlock.varName}.children[${
            currentBlock.childNumber - 1
          }] = new CollectionBlock(${l});`
        );
      } else {
        ctx.addLine(`const ${id} = new CollectionBlock(${l});`);
        if (!ctx.rootBlock) {
          ctx.rootBlock = id;
        }
      }

      ctx.addLine(`for (let i = 0; i < ${l}; i++) {`);
      ctx.indentLevel++;
      ctx.addLine(`ctx[\`${ast.elem}\`] = ${vals}[i];`);
      ctx.addLine(`ctx[\`${ast.elem}_first\`] = i === 0;`);
      ctx.addLine(`ctx[\`${ast.elem}_last\`] = i === ${vals}.length - 1;`);
      ctx.addLine(`ctx[\`${ast.elem}_index\`] = i;`);
      ctx.addLine(`ctx[\`${ast.elem}_value\`] = ${keys}[i];`);

      const collectionBlock: BlockDescription = {
        name: "Collection",
        varName: id,
        updateFn: [],
        currentPath: [],
        textNumber: 0,
        childNumber: 0,
      };
      compileAST(ast.body, collectionBlock, "i", true, ctx);
      ctx.indentLevel--;
      ctx.addLine(`}`);
      break;
    }

    // -------------------------------------------------------------------------
    // t-foreach
    // -------------------------------------------------------------------------

    case ASTType.TKey: {
      const id = ctx.generateId("k");
      ctx.addLine(`const ${id} = ${compileExpr(ast.expr, {})};`);
      const currentKey = ctx.key;
      ctx.key = id;
      compileAST(ast.content, currentBlock, currentIndex, forceNewBlock, ctx);
      ctx.key = currentKey;
      break;
    }

    // -------------------------------------------------------------------------
    // multi block
    // -------------------------------------------------------------------------

    case ASTType.Multi: {
      if (!currentBlock || forceNewBlock) {
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
      }

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

    // -------------------------------------------------------------------------
    // t-call
    // -------------------------------------------------------------------------
    case ASTType.TCall: {
      if (ast.body) {
        ctx.addLine(`ctx = Object.create(ctx);`);
        // check if all content is t-set
        const hasContent = ast.body.filter((elem) => elem.type !== ASTType.TSet).length;
        if (hasContent) {
          const nextId = ctx.nextId;
          compileAST({ type: ASTType.Multi, content: ast.body }, null, 0, true, ctx);
          ctx.addLine(`ctx[zero] = b${nextId};`);
        } else {
          for (let elem of ast.body) {
            compileAST(elem, currentBlock, 0, false, ctx);
          }
        }
      }

      if (currentBlock) {
        if (!forceNewBlock) {
          const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
          addToBlockDom(currentBlock, anchor);
          currentBlock.currentPath = [`anchors[${currentBlock.childNumber}]`];
          currentBlock.childNumber++;
        }

        ctx.addLine(
          `${currentBlock.varName}.children[${currentBlock.childNumber - 1}] = call(\`${
            ast.name
          }\`, ctx);`
        );
      } else {
        const id = ctx.generateId("b");
        ctx.rootBlock = id;
        ctx.addLine(`const ${id} = call(\`${ast.name}\`, ctx);`);
      }
      if (ast.body) {
        ctx.addLine(`ctx = ctx.__proto__;`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // t-set/t-value
    // -------------------------------------------------------------------------
    case ASTType.TSet: {
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

function call(name: string): BDom {
  throw new Error(`Missing template: "${name}"`);
}

function getValues(collection: any): [any[], any[], number] {
  if (Array.isArray(collection)) {
    return [collection, collection, collection.length];
  } else {
    const keys = Object.keys(collection);
    return [keys, Object.values(collection), keys.length];
  }
}
