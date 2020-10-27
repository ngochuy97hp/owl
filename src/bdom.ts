/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

export type BDom = Block | MultiBlock;

export class Block {
  static baseEl: HTMLElement | Text;
  texts: string[];
  el!: HTMLElement | Text | null;
  children: (Block | null)[] | null = null;
  anchors!: Text[];

  constructor(texts: string[] = []) {
    this.texts = texts;
  }

  update() {}

  private build() {
    this.el = (this.constructor as any).el.cloneNode(true);
    if (this.children) {
      const anchorElems = (this.el as HTMLElement).getElementsByTagName("owl-anchor");
      const anchors = new Array(anchorElems.length);
      for (let i = 0; i < anchors.length; i++) {
        const text = document.createTextNode("");
        anchorElems[0].replaceWith(text);
        anchors[i] = text;
      }
      this.anchors = anchors;
    }
    this.update();
  }

  mount(parent: HTMLElement) {
    this._mount(parent, null);
  }

  private _mount(parent: HTMLElement, anchor: Text | null) {
    this.build();
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (child) {
          const anchor = this.anchors[i];
          child._mount(anchor.parentElement!, anchor);
        }
      }
    }
    parent.insertBefore(this.el!, anchor);
  }

  patch(newTree: Block) {
    this.texts = newTree.texts;
    this.update();
    if (this.children) {
      const children = this.children;
      const newChildren = newTree.children!;
      for (let i = 0; i < newChildren.length; i++) {
        const newChild = newChildren[i];
        const child = children[i];
        if (child) {
          if (newChild) {
            child.patch(newChild);
          } else {
            children[i] = null;
            child.el!.remove();
          }
        } else if (newChild) {
          children[i] = newChild;
          const anchor = this.anchors[i];
          newChild._mount(anchor.parentElement!, anchor);
        }
      }
    }
  }
}

export class MultiBlock {
  blocks: Block[];
  constructor(blocks: Block[]) {
    this.blocks = blocks;
  }

  mount(parent: HTMLElement) {
    for (let block of this.blocks) {
      block.mount(parent);
    }
  }
}

/**
 * Input: <div class="a"><t t-if="condition">hey</t></div>
 *
 * compile (...) output:
 *   - template nodes
 *   function render(context) => tree {idx: 0, children: []}
 */

// function makeEl(html: string): HTMLElement {
//     const div = document.createElement("div");
//     div.innerHTML = html;
//     return div.firstChild as HTMLElement;
//   }

// function templateA() {
//     // make block 1
//     class Block1 {
//       el = makeEl('<div class="a"></div>');
//       upd
//     }

//     // make block 2

//     return function render(context) {
//         const b1 = { block: block1, texts: [context.value], children: new Array(1)};
//         if (context.condition) {
//           b1.children[0] = {block: block2};
//         }
//         return b1;
//       }
// }

// function templateA() {
//     // make block 1
//     class Block1 {
//       el = makeEl('<div class="a"></div>');
//       upd
//     }

//     // make block 2

//     return function render(context) {
//         const b1 = new Block1([context.value]);
//         if (context.condition) {
//           b1.children[0] = new Block2();
//         }
//         return b1;
//       }
// }
