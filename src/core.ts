import { BDom, Block, Blocks } from "./bdom";
import { TemplateSet } from "./qweb_compiler";

export class Component {
  static template: string;

  __owl__: InternalData | null = null;
  get el(): HTMLElement | Text | null {
    return (this.__owl__ as any).bdom.el;
  }

  render() {
    const __owl__ = this.__owl__!;
    __owl__.bdom = __owl__.render();
  }
}

export class FComponent<T> extends Component {
  constructor(FC: FunctionalComponent<T>) {
    super();
    const value = FC.setup ? FC.setup() : null;
    if (value) {
      Object.assign(this, value);
    }
  }
}

export interface FunctionalComponent<T> {
  template: string;
  setup?(): T;
}

type Env = any;

interface MountParameters {
  env?: Env;
  target: HTMLElement;
  props?: any;
}

let nextId = 1;
export const globalTemplates = new TemplateSet();

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates.add(name, value);
  return name;
}

interface Type<T> extends Function {
  new (...args: any[]): T;
}

interface InternalData {
  bdom: null | BDom;
  render: () => BDom;
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
  component.render();
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
  const __owl__: InternalData = { render: render, bdom: null };
  component.__owl__ = __owl__;
  return component;
}

function internalMount(c: Component, target: any) {
  c.__owl__!.bdom!.mount(target);
}

class ComponentBlock extends Block {
  component: Component;
  constructor(ctx: any, name: string) {
    super();
    const C = ctx.constructor.components[name];
    const component = prepare(C);
    this.component = component;
    // console.warn(component);
    // console.warn(ctx.constructor.components, name);
    component.render();
  }
  mountBefore(anchor: Text) {
    this.component.__owl__!.bdom!.mountBefore(anchor);
  }
  patch() {}
}

Blocks.ComponentBlock = ComponentBlock;
