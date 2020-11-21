import { BDom, Block, Blocks } from "./bdom";
import { TemplateSet } from "./qweb_compiler";

// -----------------------------------------------------------------------------
//  Global templates
// -----------------------------------------------------------------------------

let nextId = 1;
export const globalTemplates = new TemplateSet();

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates.add(name, value);
  return name;
}

// -----------------------------------------------------------------------------
//  Component
// -----------------------------------------------------------------------------

interface InternalData {
  bdom: null | BDom;
  render: () => BDom;
  fiber: Fiber | null;
}

export class Component {
  static template: string;

  __owl__: InternalData | null = null;
  get el(): HTMLElement | Text | null {
    return (this.__owl__ as any).bdom.el;
  }

  async render(): Promise<void> {
    internalRender(this);

    const __owl__ = this.__owl__!;
    __owl__.bdom!.patch(__owl__.fiber!.bdom!);
  }
}

// -----------------------------------------------------------------------------
//  Functional Component stuff
// -----------------------------------------------------------------------------

export interface FunctionalComponent<T = any> {
  template: string;
  components?: { [name: string]: Type<Component> | FunctionalComponent };
  setup?(): T;
}

export class FComponent<T> extends Component {
  components: { [name: string]: Type<Component> | FunctionalComponent };
  constructor(FC: FunctionalComponent<T>) {
    super();
    this.components = FC.components || {};
    const value = FC.setup ? FC.setup() : null;
    if (value) {
      Object.assign(this, value);
    }
  }
}

// -----------------------------------------------------------------------------
//  Component Block
// -----------------------------------------------------------------------------

class ComponentBlock extends Block {
  component: Component;
  constructor(ctx: any, name: string) {
    super();
    const components = ctx.constructor.components || ctx.components;
    const C = components[name];
    const component = prepare(C);
    this.component = component;
    internalRender(component);
  }
  mountBefore(anchor: Text) {
    this.component.__owl__!.bdom = this.component.__owl__!.fiber!.bdom;
    this.component.__owl__!.bdom!.mountBefore(anchor);
  }
  patch() {}
}

Blocks.ComponentBlock = ComponentBlock;

// -----------------------------------------------------------------------------
//  Internal rendering stuff
// -----------------------------------------------------------------------------

class Fiber {
  bdom: BDom | null = null;
}

type Env = any;

interface MountParameters {
  env?: Env;
  target: HTMLElement;
  props?: any;
}

interface Type<T> extends Function {
  new (...args: any[]): T;
}

export function mount<T extends Type<Component>>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>>;
export function mount<T>(
  C: FunctionalComponent<T>,
  params: MountParameters
): Promise<Component & T>;
export async function mount(C: any, params: MountParameters) {
  const { target } = params;
  const component = prepare(C);
  internalRender(component);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      internalMount(component, target);
      resolve(component as any);
    });
  });
}

function prepare(C: any): Component {
  let component: Component;
  let template: string;
  if (C.prototype instanceof Component) {
    component = new C();
    template = (C as any).template;
  } else {
    component = new FComponent(C);
    template = C.template;
  }
  const render: () => BDom = globalTemplates.getFunction(template).bind(null, component);
  const __owl__: InternalData = { render: render, bdom: null, fiber: null };
  component.__owl__ = __owl__;
  return component;
}

function internalRender(c: Component) {
  const fiber = new Fiber();
  const __owl__ = c.__owl__!;
  __owl__.fiber = fiber;
  fiber.bdom = __owl__.render();
}

function internalMount(c: Component, target: any) {
  c.__owl__!.bdom! = c.__owl__!.fiber!.bdom!;
  c.__owl__!.bdom!.mount(target);
}
