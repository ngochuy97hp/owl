import { BDom } from "./bdom";
import { TemplateSet } from "./qweb_compiler";
export class Component {
  static template: string;

  __owl__: InternalData | null = null;
  get el(): HTMLElement | Text | null {
    return (this.__owl__ as any).bdom.el;
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
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const bdom = render();
      bdom.mount(target);
      __owl__.bdom = bdom;
      resolve(component as any);
    });
  });
}
