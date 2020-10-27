import { BDom } from "../src/bdom";
import { compile, compileTemplate } from "../src/compiler";
import { makeTestFixture } from "./helpers";

function renderToBdom(template: string, context: any = {}): BDom {
  expect(compileTemplate(template).toString()).toMatchSnapshot();
  return compile(template)(context);
}

function renderToString(template: string, context: any = {}): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context);
  bdom.mount(fixture);
  return fixture.innerHTML;
}

describe("compiler", () => {
  test("simple string", () => {
    const template = `hello vdom`;
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("simple string in t tag", () => {
    const template = `<t>hello vdom</t>`;
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("empty string", () => {
    const template = ``;
    expect(renderToString(template)).toBe("");
  });

  test("empty div", () => {
    const template = `<div></div>`;
    expect(renderToString(template)).toBe("<div></div>");
  });

  test("div with content", () => {
    const template = `<div>foo</div>`;
    expect(renderToString(template)).toBe("<div>foo</div>");
  });

  test("multiple root nodes", () => {
    const template = `<div>foo</div><span>hey</span>`;
    expect(renderToString(template)).toBe("<div>foo</div><span>hey</span>");
  });
});
