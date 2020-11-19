import { fromName, makeTestFixture, snapshotTemplateCode } from "./helpers";
import { mount, Component, xml } from "../src/core";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("can mount a simple class component", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    const component = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
    snapshotTemplateCode(Test.template);
  });

  test("can mount a simple class component", async () => {
    const Test = {
      template: xml`<span>simple vnode</span>`,
    };

    const component = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
    snapshotTemplateCode(fromName(Test.template));
  });

  test("simple functional component with text node", async () => {
    const Test = {
      template: xml`look, just text!`,
    };

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("look, just text!");
    snapshotTemplateCode(fromName(Test.template));
  });

  test("class component with dynamic text", async () => {
    class Test extends Component {
      static template = xml`<span>My value: <t t-esc="value"/></span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>My value: 42</span>");
    snapshotTemplateCode(fromName(Test.template));
  });

  test("Multi root component", async () => {
    class Test extends Component {
      static template = xml`<span>1</span>text<span>2</span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe(`<span>1</span>text<span>2</span>`);
    snapshotTemplateCode(fromName(Test.template));
  });
});
