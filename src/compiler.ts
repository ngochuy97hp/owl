import { BDom, Block, MultiBlock } from "./bdom";
import { AST, ASTType, parse } from "./parser";

// -----------------------------------------------------------------------------
// Compile functions
// -----------------------------------------------------------------------------

export type RenderFunction = (context: any) => BDom;
export type TemplateFunction = (
  block: typeof Block,
  multiBlock: typeof MultiBlock,
  elem: any
) => RenderFunction;

export function compile(template: string): RenderFunction {
  const templateFunction = compileTemplate(template);
  return templateFunction(Block, MultiBlock, elem);
}

export function compileTemplate(template: string): TemplateFunction {
  const ast = parse(template);
  const ctx = new CompilationContext();
  compileAST(ast, ctx);
  const code = ctx.generateCode();
  return new Function("Block, MultiBlock, elem", code) as TemplateFunction;
}

// -----------------------------------------------------------------------------
// Compilation Context
// -----------------------------------------------------------------------------

interface BlockDescription {
  name: string;
  elem: string;
}

class CompilationContext {
  code: string[] = [];
  indentLevel: number = 0;
  blocks: BlockDescription[] = [];

  addLine(line: string) {
    const prefix = new Array(this.indentLevel + 2).join("  ");
    this.code.push(prefix + line);
  }

  addBlock(elem: string): string {
    const name = `Block${this.blocks.length + 1}`;
    this.blocks.push({ name, elem });
    return name;
  }
  generateCode(): string {
    const mainCode = this.code;
    this.code = [];
    this.indentLevel = 0;
    // define all blocks
    for (let block of this.blocks) {
      this.addLine(`class ${block.name} extends Block {`);
      this.indentLevel++;
      this.addLine(`static el = elem("${block.elem}");`);
      this.indentLevel--;
      this.addLine(`}`);
    }

    // generate main code
    this.indentLevel = 0;
    this.addLine(``);
    this.addLine(`return context => {`);
    for (let line of mainCode) {
      this.addLine(line);
    }
    this.addLine("}");
    return this.code.join("\n");
  }
}

// -----------------------------------------------------------------------------
// Compiler code
// -----------------------------------------------------------------------------

export function compileAST(ast: AST, ctx: CompilationContext) {
  switch (ast.type) {
    case ASTType.Text: {
      const BlockClass = compileBlock(ast, ctx);
      ctx.addLine(`return new ${BlockClass}();`);
      break;
    }
    case ASTType.DomNode: {
      const BlockClass = compileBlock(ast, ctx);
      ctx.addLine(`return new ${BlockClass}();`);
      break;
    }
    case ASTType.Multi: {
      const Blocks = ast.content.map((ast) => compileBlock(ast, ctx));
      const blockList = Blocks.map((B) => `new ${B}()`);
      ctx.addLine(`return new MultiBlock([${blockList.join(", ")}]);`);
      break;
    }
    default:
      throw new Error("not yet supported");
  }
}

function compileBlock(ast: AST, ctx: CompilationContext): string {
  const elem = astToString(ast);
  const BlockClass = ctx.addBlock(elem);
  return BlockClass;
}

function astToString(ast: AST): string {
  switch (ast.type) {
    case ASTType.Text:
      return ast.value;
    case ASTType.DomNode:
      const content = ast.content ? astToString(ast.content) : "";
      return `<${ast.tag}>${content}</${ast.tag}>`;
    default:
      throw new Error(`not yet supported ${ast.type}`);
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function elem(html: string): HTMLElement | Text {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.firstChild as HTMLElement | Text) || document.createTextNode("");
}
