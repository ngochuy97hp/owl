import { TemplateSet } from "./compiler";
export class Component {
  static template: string;

  __owl__: any;
  get el(): HTMLElement | Text | null {
    return this.__owl__.bdom.el;
  }
}

export class FComponent extends Component {
  constructor(C: any) {
    super();
  }
}

type Env = any;

interface MountParameters {
  env?: Env;
  target: HTMLElement;
  props?: any;
}

let nextId = 1;
const templateSet = new TemplateSet();

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${nextId++}`;
  const value = String.raw(strings, ...args);
  templateSet.add(name, value);
  return name;
}

interface Type<T> extends Function {
  new (...args: any[]): T;
}

export async function mount<T extends Type<Component>>(
  C: T | any,
  params: MountParameters
): Promise<InstanceType<T>> {
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
  const renderFunction = templateSet.getFunction(template);
  const bdom = renderFunction(component);
  const __owl__ = { renderFunction, bdom };
  component.__owl__ = __owl__;
  bdom.mount(target);
  return component as any;
}
