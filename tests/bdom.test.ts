import { AnchorBlock, Block, MultiBlock } from "../src/bdom";
import { makeTestFixture } from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

function el(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstChild as HTMLElement;
}
//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("mount", () => {
  test("simple block", async () => {
    class Block1 extends Block {
      static el = el("<div>foo</div>");
    }

    const tree = new Block1();
    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("simple block with string", async () => {
    class Block1 extends Block {
      static el = el("foo");
    }

    const tree = new Block1();
    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("foo");
  });

  test("simple block with multiple roots", async () => {
    class Block1 extends Block {
      static el = el("<div>foo</div>");
    }
    class Block2 extends Block {
      static el = el("<span>bar</span>");
    }

    const blocks = [new Block1(), new Block2()];
    const tree = new MultiBlock(blocks);
    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div><span>bar</span>");
  });

  test("block with dynamic content", async () => {
    class Block1 extends Block {
      static el = el("<div><p></p></div>");
      texts = new Array(1);
      update() {
        this.el!.firstChild!.textContent = this.texts[0];
      }
    }

    const tree = new Block1();
    tree.texts[0] = "foo";
    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("block with subblock", async () => {
    class Block1 extends Block {
      static el = el("<div><span></span><owl-anchor></owl-anchor></div>");
      children = new Array(1);
      texts = new Array(1);
      update() {
        this.el!.firstChild!.textContent = this.texts[0];
      }
    }

    class Block2 extends Block {
      static el = el("<p>yip yip</p>");
    }

    const tree = new Block1();
    tree.texts[0] = "foo";
    tree.children[0] = new Block2();

    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>foo</span><p>yip yip</p></div>");
  });

  test("block with subblock with siblings", async () => {
    class Block1 extends Block {
      static el = el("<div><p>1</p><owl-anchor></owl-anchor><p>2</p></div>");
      children = new Array(1);
      refs = new Array(1);
    }

    class Block2 extends Block {
      static el = el("<p>yip yip</p>");
    }

    const tree = new Block1();
    tree.children[0] = new Block2();

    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>yip yip</p><p>2</p></div>");
  });
});

describe("update", () => {
  test("block with dynamic content", async () => {
    class Block1 extends Block {
      static el = el("<div><p></p></div>");
      texts = new Array(1);
      update() {
        this.el!.firstChild!.textContent = this.texts[0];
      }
    }

    const tree1 = new Block1();
    tree1.texts[0] = "foo";
    tree1.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");

    const tree2 = new Block1();
    tree2.texts[0] = "bar";
    tree1.patch(tree2);
    expect(fixture.innerHTML).toBe("<div><p>bar</p></div>");
  });

  test("block with conditional child", async () => {
    class Block1 extends Block {
      static el = el("<div><p><owl-anchor></owl-anchor></p></div>");
      children = new Array(1);
    }
    class Block2 extends Block {
      static el = el("<span>foo</span>");
    }

    const tree = new Block1();
    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p></p></div>");

    const tree2 = new Block1();
    tree2.children[0] = new Block2();
    tree.patch(tree2);
    expect(fixture.innerHTML).toBe("<div><p><span>foo</span></p></div>");

    const tree3 = new Block1();
    tree.patch(tree3);
    expect(fixture.innerHTML).toBe("<div><p></p></div>");
  });

  test("block with subblock with dynamic content", async () => {
    class Block1 extends Block {
      static el = el("<div><owl-anchor></owl-anchor></div>");
      children = new Array(1);
    }

    class Block2 extends Block {
      static el = el("<p></p>");
      texts = new Array(1);
      update() {
        this.el!.textContent = this.texts[0];
      }
    }

    const tree = new Block1();
    tree.children[0] = new Block2();
    tree.children[0].texts[0] = "yip yip";

    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");

    const tree2 = new Block1();
    tree2.children[0] = new Block2();
    tree2.children[0].texts[0] = "foo";

    tree.patch(tree2);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("anchor block", async () => {
    class Block1 extends Block {
      static el = el(`ok`);
    }

    const tree = new AnchorBlock();
    tree.children[0] = new Block1();

    tree.mount(fixture);
    expect(fixture.innerHTML).toBe("ok");

    const tree2 = new AnchorBlock();
    tree.patch(tree2);
    expect(fixture.innerHTML).toBe("");

    const tree3 = new AnchorBlock();
    tree3.children[0] = new Block1();
    tree.patch(tree3);
    expect(fixture.innerHTML).toBe("ok");
  });
});
