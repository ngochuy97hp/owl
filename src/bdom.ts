/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

export type BDom = ContentBlock | MultiBlock | HTMLBlock;

abstract class Block {
  mount(parent: HTMLElement) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.mountBefore(anchor);
    anchor.remove();
  }

  abstract mountBefore(anchor: Text): void;

  abstract patch(other: Block): void;

  remove() {}
}

export class HTMLBlock extends Block {
  html: string;
  content: ChildNode[] = [];
  anchor: Text;
  constructor(html: any) {
    super();
    this.html = String(html);
    this.anchor = document.createTextNode("");
  }

  mountBefore(anchor: Text) {
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
  }

  remove() {
    for (let elem of this.content) {
      elem.remove();
    }
    this.anchor.remove();
  }

  patch(other: any) {
    for (let elem of this.content) {
      elem.remove();
    }
    this.build();
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  toString(): string {
    return this.html;
  }
}

export class ContentBlock extends Block {
  static el: HTMLElement | Text;
  el?: HTMLElement | Text;
  children: (ContentBlock | null)[] | null = null;
  anchors?: Text[];
  texts: string[] = [];

  toString(): string {
    const div = document.createElement("div");
    this.mount(div);
    return div.innerHTML;
  }

  mountBefore(anchor: Text) {
    this.build();
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (child) {
          const anchor = this.anchors![i];
          child.mountBefore(anchor);
        }
      }
    }
    anchor.before(this.el!);
  }

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

  patch(newTree: any) {
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
            child.remove();
          }
        } else if (newChild) {
          children[i] = newChild;
          const anchor = this.anchors![i];
          newChild.mountBefore(anchor);
        }
      }
    }
  }

  remove() {
    this.el!.remove();
  }
}

export class MultiBlock extends Block {
  children: (ContentBlock | undefined | null)[];
  anchors?: Text[];

  constructor(n: number) {
    super();
    this.children = new Array(n);
    this.anchors = new Array(n);
  }

  mountBefore(anchor: Text) {
    for (let i = 0; i < this.children.length; i++) {
      let child: any = this.children[i];
      const childAnchor = document.createTextNode("");
      anchor.before(childAnchor);
      this.anchors![i] = childAnchor;
      if (child) {
        child.mountBefore(childAnchor);
      }
    }
  }

  patch(newTree: any) {
    for (let i = 0; i < this.children.length; i++) {
      const block = this.children[i];
      const newBlock = newTree.children[i];
      if (block) {
        if (newBlock) {
          block.patch(newBlock);
        } else {
          this.children[0] = null;
          block.remove();
        }
      } else if (newBlock) {
        this.children[i] = newBlock;
        newBlock.mountBefore(this.anchors![i]);
      }
    }
  }

  remove() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i]!.remove();
      this.anchors![i].remove();
    }
  }

  toString(): string {
    return this.children.map((c) => (c ? c.toString() : "")).join("");
  }
}
