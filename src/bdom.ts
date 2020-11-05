/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

export type BDom = Block | MultiBlock;

export class Block {
  static el: HTMLElement | Text;
  texts: string[] = [];
  el!: HTMLElement | Text | null;
  children: (Block | null)[] | null = null;
  anchors!: Text[];

  update() {}

  protected build() {
    this.el = (this.constructor as any).el.cloneNode(true);
    if (this.children) {
      const anchorElems = (this.el as HTMLElement).getElementsByTagName("owl-anchor");
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

  mount(parent: HTMLElement) {
    this._mount();
    parent.appendChild(this.el!);
  }

  protected _mount() {
    this.build();
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (child) {
          const anchor = this.anchors[i];
          child._mount();
          anchor.replaceWith(child.el!);
        }
      }
    }
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
            child.el!.replaceWith(this.anchors[i]);
          }
        } else if (newChild) {
          children[i] = newChild;
          const anchor = this.anchors[i];
          newChild._mount();
          anchor.replaceWith(newChild.el!);
        }
      }
    }
  }
}

export class AnchorBlock extends Block {
  children = new Array(1);

  protected _mount() {
    const child = this.children[0];
    if (child) {
      child._mount();
      this.el = child.el;
    } else {
      this.el = document.createTextNode("");
    }
  }
  patch(newTree: AnchorBlock) {
    const child = this.children[0];
    const newChild = newTree.children[0];
    if (child) {
      if (newChild) {
        child.patch(newChild);
      } else {
        this.children[0] = null;
        this.el = document.createTextNode("");
        child.el.replaceWith(this.el);
      }
    } else if (newChild) {
      this.children[0] = newChild;
      newChild._mount();
      this.el!.replaceWith(newChild.el);
      this.el = newChild.el;
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
