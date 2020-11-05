import { BDom, Block, AnchorBlock, MultiBlock } from "./bdom";
import { compileExpr } from "./expression_parser";
import { AST, ASTType, parse } from "./parser";

// -----------------------------------------------------------------------------
// Compile functions
// -----------------------------------------------------------------------------

export type RenderFunction = (context: any) => BDom;
export type TemplateFunction = (
  block: typeof Block,
  anchorblock: typeof AnchorBlock,
  multiBlock: typeof MultiBlock,
  elem: any
) => RenderFunction;

export function compile(template: string): RenderFunction {
  const templateFunction = compileTemplate(template);
  return templateFunction(Block, AnchorBlock, MultiBlock, elem);
}

export function compileTemplate(template: string): TemplateFunction {
  const ast = parse(template);
  const ctx = new CompilationContext();
  compileAST(ast, ctx);
  const code = ctx.generateCode();
  // console.warn(code);
  return new Function("Block, AnchorBlock, MultiBlock, elem", code) as TemplateFunction;
}

// -----------------------------------------------------------------------------
// Compilation Context
// -----------------------------------------------------------------------------

interface BlockDescription {
  name: string;
  updateFn: string[];
  varName: string;
  currentPath: string[];
  texts: string[];
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

class CompilationContext {
  code: string[] = [];
  indentLevel: number = 0;
  blocks: BlockDescription[] = [];
  rootBlocks: string[] = [];
  nextId = 1;

  addLine(line: string) {
    const prefix = new Array(this.indentLevel + 2).join("  ");
    this.code.push(prefix + line);
  }

  generateId(prefix: string = ""): string {
    return `${prefix}${this.nextId++}`;
  }

  makeBlock(): BlockDescription {
    const block: BlockDescription = {
      name: `Block${this.blocks.length + 1}`,
      varName: this.generateId("b"),
      updateFn: [],
      currentPath: ["el"],
      texts: [],
      childNumber: 0,
    };
    this.blocks.push(block);
    return block;
  }

  generateCode(): string {
    const mainCode = this.code;
    this.code = [];
    this.indentLevel = 0;
    // define all blocks
    for (let block of this.blocks) {
      this.addLine(`class ${block.name} extends Block {`);
      this.indentLevel++;
      this.addLine(`static el = elem(\`${domToString(block.dom!)}\`);`);
      if (block.childNumber) {
        this.addLine(`children = new Array(${block.childNumber});`);
      }
      if (block.texts.length) {
        this.addLine(`texts = new Array(${block.texts.length});`);
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
    // if (this.rootBlocks.length === 1 && this.blocks.length === 1) {
    //   // micro optimisation: remove assignation
    //   const last = mainCode.pop()!.trimLeft();
    //   const block = last.replace(`const ${this.rootBlocks[0]} = `, "");
    //   this.rootBlocks[0] = block.slice(0, -1);
    // }
    this.indentLevel = 0;
    this.addLine(``);
    this.addLine(`return ctx => {`);
    for (let line of mainCode) {
      this.addLine(line);
    }
    if (this.rootBlocks.length === 1) {
      this.addLine(`  return ${this.rootBlocks[0]};`);
    } else {
      const blocks = this.rootBlocks.join(`, `);
      this.addLine(`  return new MultiBlock([${blocks}])`);
    }
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

export function compileAST(ast: AST, ctx: CompilationContext) {
  switch (ast.type) {
    case ASTType.Multi:
      if (ast.content.length === 1) {
        compileAST(ast.content[0], ctx);
      } else {
        for (let child of ast.content) {
          compileAST(child, ctx);
        }
      }
      break;
    case ASTType.TIf:
      const anchorBlock: BlockDescription = {
        name: `AnchorBlock`,
        varName: ctx.generateId("b"),
        updateFn: [],
        currentPath: [],
        texts: [],
        childNumber: 0,
      };
      ctx.rootBlocks.push(anchorBlock.varName);
      ctx.addLine(`const ${anchorBlock.varName} = new ${anchorBlock.name}();`);
      compileASTBlock(ast, anchorBlock, ctx);
      break;
    default:
      const block = ctx.makeBlock();
      ctx.addLine(`const ${block.varName} = new ${block.name}();`);
      compileASTBlock(ast, block, ctx);
      // const childblocks = block.texts.length ? "[" + block.texts.join(",") + "]" : "";
      ctx.rootBlocks.push(block.varName);
  }
}

function compileASTBlock(ast: AST, block: BlockDescription, ctx: CompilationContext) {
  switch (ast.type) {
    case ASTType.Text:
    case ASTType.Comment: {
      const type = ast.type === ASTType.Text ? DomType.Text : DomType.Comment;
      const text: Dom = { type, value: ast.value };
      if (block.currentDom) {
        block.currentDom.content.push(text);
      } else {
        block.dom = text;
      }
      break;
    }
    case ASTType.DomNode: {
      const dom: Dom = { type: DomType.Node, tag: ast.tag, attrs: ast.attrs, content: [] };

      if (block.currentDom) {
        block.currentDom.content.push(dom);
      } else {
        block.dom = dom;
      }
      if (ast.content.length) {
        const initialDom = block.currentDom;
        block.currentDom = dom;
        const path = block.currentPath.slice();
        block.currentPath.push("firstChild");
        for (let child of ast.content) {
          compileASTBlock(child, block, ctx);
          block.currentPath.push("nextSibling");
        }
        block.currentPath = path;
        block.currentDom = initialDom;
      }
      break;
    }
    case ASTType.TEsc: {
      const targetEl = `this.` + block.currentPath.join(".");
      const text: Dom = { type: DomType.Node, tag: "owl-text", attrs: {}, content: [] };
      if (block.currentDom) {
        block.currentDom.content.push(text);
      } else {
        block.dom = text;
      }
      const textId = ctx.generateId("t");
      const idx = block.texts.push(textId) - 1;
      ctx.addLine(`${block.varName}.texts[${idx}] = ${compileExpr(ast.expr, {})};`);
      block.updateFn.push(`${targetEl}.textContent = this.texts[${idx}];`);
      break;
    }
    case ASTType.TIf: {
      const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
      if (block.currentDom) {
        block.currentDom.content.push(anchor);
      } else {
        block.dom = anchor;
      }
      block.childNumber++;
      ctx.addLine(`if (${compileExpr(ast.condition, {})}) {`);
      ctx.indentLevel++;
      const subBlock = ctx.makeBlock();
      ctx.addLine(`${block.varName}.children[${block.childNumber - 1}] = new ${subBlock.name}();`);

      compileASTBlock({ type: ASTType.Multi, content: ast.content }, subBlock, ctx);
      ctx.indentLevel--;
      ctx.addLine(`}`);
      break;
    }
    case ASTType.Multi: {
      for (let content of ast.content) {
        compileASTBlock(content, block, ctx);
      }
      break;
    }
    default:
      throw new Error(`not yet supported`);
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
