import { globalTemplates } from "../src/core";
import { compileTemplate } from "../src/qweb_compiler";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function snapshotTemplateCode(template: string) {
  expect(compileTemplate(template).toString()).toMatchSnapshot();
}

/**
 * Return the global template xml string corresponding to the given name
 */
export function fromName(name: string): string {
  return globalTemplates.templates[name];
}

export function trim(str: string): string {
  return str.replace(/\s/g, "");
}
