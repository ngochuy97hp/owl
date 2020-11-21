import { fromName, makeTestFixture, snapshotTemplateCode, nextTick } from "./helpers";
import { mount, Component, xml, useState } from "../src/core";

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

  test("functional component: setup return value is context", async () => {
    const Test = {
      template: xml`<span>My value: <t t-esc="value"/></span>`,
      setup() {
        return { value: 42 };
      },
    };

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

  test("a class component inside a class component", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<span><Child/></span>`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div></span>");
  });

  test("a class component inside a class component, no external dom", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>");
  });

  test("a functional component inside a class component", async () => {
    const Child = {
      template: xml`<div>simple vnode</div>`,
    };

    class Parent extends Component {
      static template = xml`<span><Child/></span>`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div></span>");
  });

  test("a functional component inside a functional component", async () => {
    const Child = {
      template: xml`<div>simple vnode</div>`,
    };

    const Parent = {
      template: xml`<span><Child/></span>`,
      components: { Child },
    };
    snapshotTemplateCode(fromName(Parent.template));

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div></span>");
  });

  test("a class component inside a functional component", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    const Parent = {
      template: xml`<span><Child/></span>`,
      components: { Child },
    };

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div></span>");
  });

  test("simple component with a dynamic text", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="value" /></div>`;
      value = 3;
    }

    const test = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    test.value = 5;
    await test.render();
    expect(fixture.innerHTML).toBe("<div>5</div>");
  });

  test("simple component, useState", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="state.value" /></div>`;
      state = useState({ value: 3 });
    }

    const test = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    test.state.value = 5;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>5</div>");
  });
});
