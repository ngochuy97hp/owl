import { BDom, Block, Blocks } from "./bdom";
import { TemplateSet } from "./qweb_compiler";
import { observe } from "./reactivity";

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
  willStartCB: Function;
}

export class Component {
  static template: string;
  props: any;

  constructor(props: any) {
    current = this;
    this.props = props;
  }

  __owl__: InternalData | null = null;
  get el(): HTMLElement | Text | null {
    return (this.__owl__ as any).bdom.el;
  }

  async willStart(): Promise<void> {}

  async render(): Promise<void> {
    await internalRender(this);

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
  constructor(FC: FunctionalComponent<T>, props: any) {
    super(props);
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
  constructor(ctx: any, name: string, props: any) {
    super();
    const components = ctx.constructor.components || ctx.components;
    const C = components[name];
    const component = prepare(C, props);
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
//  useState
// -----------------------------------------------------------------------------

export function useState<T>(state: T): T {
  const component: Component = current!;
  return observe(state, () => component.render());
}

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

let current: Component | null = null;

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
  const component = prepare(C, params.props || {});
  internalRender(component);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      internalMount(component, target);
      resolve(component as any);
    });
  });
}

function prepare(C: any, props: any): Component {
  let component: Component;
  let template: string;
  if (C.prototype instanceof Component) {
    component = new C(props);
    template = (C as any).template;
  } else {
    component = new FComponent(C, props);
    template = C.template;
  }
  const render: () => BDom = globalTemplates.getFunction(template).bind(null, component);
  const __owl__: InternalData = {
    render: render,
    bdom: null,
    fiber: null,
    willStartCB: component.willStart,
  };
  component.__owl__ = __owl__;
  return component;
}

async function internalRender(c: Component) {
  const fiber = new Fiber();
  const __owl__ = c.__owl__!;
  __owl__.fiber = fiber;
  await __owl__.willStartCB.call(c);
  fiber.bdom = __owl__.render();
}

function internalMount(c: Component, target: any) {
  c.__owl__!.bdom! = c.__owl__!.fiber!.bdom!;
  c.__owl__!.bdom!.mount(target);
}
