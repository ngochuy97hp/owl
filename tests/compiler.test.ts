import { BDom } from "../src/bdom";
import { compile, compileTemplate, TemplateSet } from "../src/compiler";
import { makeTestFixture } from "./helpers";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function renderToBdom(template: string, context: any = {}): BDom {
  return compile(template)(context);
}

function renderToString(template: string, context: any = {}): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context);
  bdom.mount(fixture);
  return fixture.innerHTML;
}

function snapshotCompiledCode(template: string) {
  expect(compileTemplate(template).toString()).toMatchSnapshot();
}

class TestTemplateSet extends TemplateSet {
  renderToString(name: string, context: any = {}): string {
    const renderFn = this.getFunction(name);
    const bdom = renderFn(context);
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    return fixture.innerHTML;
  }
}

// -----------------------------------------------------------------------------
// Simple templates, mostly static
// -----------------------------------------------------------------------------

describe("simple templates, mostly static", () => {
  test("simple string", () => {
    const template = `hello vdom`;
    expect(renderToString(template)).toBe("hello vdom");
    snapshotCompiledCode(template);
  });

  test("simple string in t tag", () => {
    const template = `<t>hello vdom</t>`;
    expect(renderToString(template)).toBe("hello vdom");
    snapshotCompiledCode(template);
  });

  test("empty string", () => {
    const template = ``;
    expect(renderToString(template)).toBe("");
    snapshotCompiledCode(template);
  });

  test("empty div", () => {
    const template = `<div></div>`;
    expect(renderToString(template)).toBe("<div></div>");
    snapshotCompiledCode(template);
  });

  test("div with content", () => {
    const template = `<div>foo</div>`;
    expect(renderToString(template)).toBe("<div>foo</div>");
    snapshotCompiledCode(template);
  });

  test("multiple root nodes", () => {
    const template = `<div>foo</div><span>hey</span>`;
    expect(renderToString(template)).toBe("<div>foo</div><span>hey</span>");
    snapshotCompiledCode(template);
  });

  test("dynamic text value", () => {
    const template = `<t><t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("owl");
    snapshotCompiledCode(template);
  });

  test("two t-escs next to each other", () => {
    const template = `<t><t t-esc="text1"/><t t-esc="text2"/></t>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
    snapshotCompiledCode(template);
  });

  test("two t-escs next to each other, in a div", () => {
    const template = `<div><t t-esc="text1"/><t t-esc="text2"/></div>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("<div>helloowl</div>");
    snapshotCompiledCode(template);
  });

  test("static text and dynamic text", () => {
    const template = `<t>hello <t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotCompiledCode(template);
  });

  test("static text and dynamic text (no t tag)", () => {
    const template = `hello <t t-esc="text"/>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotCompiledCode(template);
  });

  test("t-esc in dom node", () => {
    const template = `<div><t t-esc="text"/></div>`;
    expect(renderToString(template, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotCompiledCode(template);
  });

  test("dom node with t-esc", () => {
    const template1 = `<div t-esc="text" />`;
    expect(renderToString(template1, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotCompiledCode(template1);
    const template2 = `<div t-esc="text"></div>`;
    expect(renderToString(template2, { text: "hello owl" })).toBe("<div>hello owl</div>");
  });

  test("t-esc in dom node, variations", () => {
    const template1 = `<div>hello <t t-esc="text"/></div>`;
    expect(renderToString(template1, { text: "owl" })).toBe("<div>hello owl</div>");
    snapshotCompiledCode(template1);
    const template2 = `<div>hello <t t-esc="text"/> world</div>`;
    expect(renderToString(template2, { text: "owl" })).toBe("<div>hello owl world</div>");
    snapshotCompiledCode(template2);
  });

  test("div with a class attribute", () => {
    const template = `<div class="abc">foo</div>`;
    expect(renderToString(template)).toBe(`<div class="abc">foo</div>`);
    snapshotCompiledCode(template);
  });

  test("div with a class attribute with a quote", () => {
    const template = `<div class="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div class="a'bc">word</div>`);
    snapshotCompiledCode(template);
  });

  test("div with an arbitrary attribute with a quote", () => {
    const template = `<div abc="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div abc="a'bc">word</div>`);
    snapshotCompiledCode(template);
  });

  test("div with an empty class attribute", () => {
    const template = `<div class="">word</div>`;
    expect(renderToString(template)).toBe(`<div>word</div>`);
    snapshotCompiledCode(template);
  });

  test("div with a span child node", () => {
    const template = `<div><span>word</span></div>`;
    expect(renderToString(template)).toBe("<div><span>word</span></div>");
    snapshotCompiledCode(template);
  });
});

// -----------------------------------------------------------------------------
// white space
// -----------------------------------------------------------------------------

describe("white space handling", () => {
  test("white space only text nodes are condensed into a single space", () => {
    const template = `<div>  </div>`;
    expect(renderToString(template)).toBe("<div> </div>");
    snapshotCompiledCode(template);
  });

  test("consecutives whitespaces are condensed into a single space", () => {
    const template = `<div>  abc  </div>`;
    expect(renderToString(template)).toBe("<div> abc </div>");
    snapshotCompiledCode(template);
  });

  test("whitespace only text nodes with newlines are removed", () => {
    const template = `<div>
        <span>abc</span>
      </div>`;

    expect(renderToString(template)).toBe("<div><span>abc</span></div>");
    snapshotCompiledCode(template);
  });

  test("nothing is done in pre tags", () => {
    const template1 = `<pre>   </pre>`;
    expect(renderToString(template1)).toBe(template1);

    const template2 = `<pre>
        some text
      </pre>`;
    snapshotCompiledCode(template2);
    expect(renderToString(template2)).toBe(template2);

    const template3 = `<pre>
        
      </pre>`;
    expect(renderToString(template3)).toBe(template3);
  });
});

// -----------------------------------------------------------------------------
// comments
// -----------------------------------------------------------------------------

describe("comments", () => {
  test("properly handle comments", () => {
    const template = `<div>hello <!-- comment-->owl</div>`;
    expect(renderToString(template)).toBe("<div>hello <!-- comment-->owl</div>");
    snapshotCompiledCode(template);
  });

  test("properly handle comments between t-if/t-else", () => {
    const template = `
      <div>
        <span t-if="true">true</span>
        <!-- comment-->
        <span t-else="">owl</span>
      </div>`;
    expect(renderToString(template)).toBe("<div><span>true</span></div>");
    snapshotCompiledCode(template);
  });
});

// -----------------------------------------------------------------------------
// attributes
// -----------------------------------------------------------------------------

describe("attributes", () => {
  test("static attributes", () => {
    const template = `<div foo="a" bar="b" baz="c"/>`;
    expect(renderToString(template)).toBe(`<div foo="a" bar="b" baz="c"></div>`);
  });

  test("static attributes with dashes", () => {
    const template = `<div aria-label="Close"/>`;
    expect(renderToString(template)).toBe(`<div aria-label="Close"></div>`);
  });

  test("static attributes on void elements", () => {
    const template = `<img src="/test.jpg" alt="Test"/>`;
    expect(renderToString(template)).toBe(`<img src="/test.jpg" alt="Test">`);
  });
});

// -----------------------------------------------------------------------------
// t-if
// -----------------------------------------------------------------------------

describe("t-if", () => {
  test("t-if in a div", () => {
    const template = `<div><t t-if="condition">ok</t></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe("<div>ok</div>");
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
    expect(renderToString(template, {})).toBe("<div></div>");
  });

  test("just a t-if", () => {
    const template = `<t t-if="condition">ok</t>`;
    expect(renderToString(template, { condition: true })).toBe("ok");
    expect(renderToString(template, { condition: false })).toBe("");
    snapshotCompiledCode(template);
  });

  test("a t-if with two inner nodes", () => {
    const template = `<t t-if="condition"><span>yip</span><div>yip</div></t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe("<span>yip</span><div>yip</div>");
    expect(renderToString(template, { condition: false })).toBe("");
  });

  test("div containing a t-if with two inner nodes", () => {
    const template = `<div><t t-if="condition"><span>yip</span><div>yip</div></t></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>yip</span><div>yip</div></div>"
    );
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
  });

  test("two consecutive t-if", () => {
    const template = `<t t-if="cond1">1</t><t t-if="cond2">2</t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("12");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("2");
  });

  test("a t-if next to a div", () => {
    const template = `<div>foo</div><t t-if="cond">1</t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { cond: true })).toBe("<div>foo</div>1");
    expect(renderToString(template, { cond: false })).toBe("<div>foo</div>");
  });

  test("two consecutive t-if in a div", () => {
    const template = `<div><t t-if="cond1">1</t><t t-if="cond2">2</t></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("<div>12</div>");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("<div>2</div>");
  });

  test("simple t-if/t-else", () => {
    const template = `<t t-if="condition">1</t><t t-else="">2</t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("2");
  });

  test("simple t-if/t-else in a div", () => {
    const template = `<div><t t-if="condition">1</t><t t-else="">2</t></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe("<div>1</div>");
    expect(renderToString(template, { condition: false })).toBe("<div>2</div>");
  });

  test("boolean value condition elif", () => {
    const template = `
      <div>
        <t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { color: "red" })).toBe("<div>red is dead</div>");
  });

  test("boolean value condition elif (no outside node)", () => {
    const template = `
        <t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { color: "red" })).toBe("red is dead");
  });

  test("boolean value condition else", () => {
    const template = `
      <div>
        <span>begin</span>
        <t t-if="condition">ok</t>
        <t t-else="">ok-else</t>
        <span>end</span>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>begin</span>ok<span>end</span></div>"
    );
  });

  test("boolean value condition false else", () => {
    const template = `
      <div><span>begin</span><t t-if="condition">fail</t>
      <t t-else="">fail-else</t><span>end</span></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: false })).toBe(
      "<div><span>begin</span>fail-else<span>end</span></div>"
    );
  });

  test("can use some boolean operators in expressions", () => {
    const template = `
      <div>
        <t t-if="cond1 and cond2">and</t>
        <t t-if="cond1 and cond3">nope</t>
        <t t-if="cond1 or cond3">or</t>
        <t t-if="cond3 or cond4">nope</t>
        <t t-if="m gt 3">mgt</t>
        <t t-if="n gt 3">ngt</t>
        <t t-if="m lt 3">mlt</t>
        <t t-if="n lt 3">nlt</t>
      </div>`;
    snapshotCompiledCode(template);
    const context = {
      cond1: true,
      cond2: true,
      cond3: false,
      cond4: false,
      m: 5,
      n: 2,
    };
    expect(renderToString(template, context)).toBe("<div>andormgtnlt</div>");
  });

  test("t-esc with t-if", () => {
    const template = `<div><t t-if="true" t-esc="'x'"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-esc with t-elif", () => {
    const template = `<div><t t-if="false">abc</t><t t-else="" t-esc="'x'"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-set, then t-if", () => {
    const template = `
      <div>
        <t t-set="title" t-value="'test'"/>
        <t t-if="title"><t t-esc="title"/></t>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>test</div>");
  });

  test("t-set, then t-if, part 2", () => {
    const template = `
      <div>
          <t t-set="y" t-value="true"/>
          <t t-set="x" t-value="y"/>
          <span t-if="x">COUCOU</span>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div><span>COUCOU</span></div>");
  });

  test("t-set, then t-if, part 3", () => {
    const template = `
      <div>
        <t t-set="y" t-value="false"/>
        <t t-set="x" t-value="y"/>
        <span t-if="x">AAA</span>
        <span t-elif="!x">BBB</span>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div><span>BBB</span></div>");
  });

  test("t-if in a t-if", () => {
    const template = `<div><t t-if="cond1"><span>1<t t-if="cond2">2</t></span></t></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe(
      "<div><span>12</span></div>"
    );
    expect(renderToString(template, { cond1: true, cond2: false })).toBe(
      "<div><span>1</span></div>"
    );
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("<div></div>");
    expect(renderToString(template, { cond1: false, cond2: false })).toBe("<div></div>");
  });

  test("t-if and t-else with two nodes", () => {
    const template = `<t t-if="condition">1</t><t t-else=""><span>a</span><span>b</span></t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("<span>a</span><span>b</span>");
  });

  test("dynamic content after t-if with two children nodes", () => {
    const template = `<div><t t-if="condition"><p>1</p><p>2</p></t><t t-esc="text"/></div>`;
    snapshotCompiledCode(template);

    // need to do it with bdom to go through the update path
    const bdom = renderToBdom(template, { condition: true, text: "owl" });
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>2</p>owl</div>");
    const bdom2 = renderToBdom(template, { condition: false, text: "halloween" });
    bdom.patch(bdom2);
    expect(fixture.innerHTML).toBe("<div>halloween</div>");
  });
});

// -----------------------------------------------------------------------------
// error handling
// -----------------------------------------------------------------------------

describe("error handling", () => {
  test("invalid xml", () => {
    const template = "<div>";
    expect(() => compile(template)).toThrow("Invalid XML in template");
  });
});

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

describe("t-esc", () => {
  test("literal", () => {
    const template = `<span><t t-esc="'ok'"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("escaping", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { var: "<ok>abc</ok>" })).toBe(
      "<span>&lt;ok&gt;abc&lt;/ok&gt;</span>"
    );
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const template = `<span t-esc="'ok'">nope</span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const template = `<span t-esc="var">nope</span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("div with falsy values", () => {
    const template = `
    <div>
      <p t-esc="v1"/>
      <p t-esc="v2"/>
      <p t-esc="v3"/>
      <p t-esc="v4"/>
      <p t-esc="v5"/>
    </div>`;
    snapshotCompiledCode(template);
    const vals = {
      v1: false,
      v2: undefined,
      v3: null,
      v4: 0,
      v5: "",
    };
    expect(renderToString(template, vals)).toBe(
      "<div><p>false</p><p></p><p></p><p>0</p><p></p></div>"
    );
  });

  test("t-esc work with spread operator", () => {
    const template = `<span><t t-esc="[...state.list]"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { state: { list: [1, 2] } })).toBe("<span>1,2</span>");
  });

  test("t-esc is escaped", () => {
    const template = `<div><t t-set="var"><p>escaped</p></t><t t-esc="var"/></div>`;
    snapshotCompiledCode(template);
    const bdom = renderToBdom(template);
    const fixture = makeTestFixture();
    bdom.mount(fixture);

    expect(fixture.textContent).toBe("<p>escaped</p>");
  });

  test("t-esc=0 is escaped", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<span><t t-esc="0"/></span>';
    const main = `<div><t t-call="sub"><p>escaped</p></t></div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotCompiledCode(main);
    snapshotCompiledCode(sub);
    const bdom = templateSet.getFunction("main")({});
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    expect(fixture.querySelector("span")!.textContent).toBe("<p>escaped</p>");
  });
});

// -----------------------------------------------------------------------------
// t-raw
// -----------------------------------------------------------------------------

describe("t-raw", () => {
  test("literal", () => {
    const template = `<span><t t-raw="'ok'"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("literal, no outside html element", () => {
    const template = `<t t-raw="'ok'"/>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("variable", () => {
    const template = `<span><t t-raw="var"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const template = `<div><t t-raw="var"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { var: "<ok></ok>" })).toBe("<div><ok></ok></div>");
  });

  test("t-raw and another sibling node", () => {
    const template = `<span><span>hello</span><t t-raw="var"/></span>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { var: "<ok>world</ok>" })).toBe(
      "<span><span>hello</span><ok>world</ok></span>"
    );
  });

  test("t-raw with comment", () => {
    const template = `<span><t t-raw="var"/></span>`;
    expect(renderToString(template, { var: "<p>text<!-- top secret --></p>" })).toBe(
      "<span><p>text<!-- top secret --></p></span>"
    );
  });
});

// -----------------------------------------------------------------------------
// t-set
// -----------------------------------------------------------------------------

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>ok</div>");
  });

  test("set from attribute literal (no outside div)", () => {
    const template = `<t><t t-set="value" t-value="'ok'"/><t t-esc="value"/></t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("t-set and t-if", () => {
    const template = `
      <div>
        <t t-set="v" t-value="value"/>
        <t t-if="v === 'ok'">grimbergen</t>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>grimbergen</div>");
  });

  test("set from body literal", () => {
    const template = `<t><t t-set="value">ok</t><t t-esc="value"/></t>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("set from attribute lookup", () => {
    const template = `<div><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("t-set evaluates an expression only once", () => {
    const template = `
      <div >
        <t t-set="v" t-value="value + ' artois'"/>
        <t t-esc="v"/>
        <t t-esc="v"/>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { value: "stella" })).toBe(
      "<div>stella artoisstella artois</div>"
    );
  });

  test("set from body lookup", () => {
    const template = `<div><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("set from empty body", () => {
    const template = `<div><t t-set="stuff"/><t t-esc="stuff"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div></div>");
  });

  test("value priority", () => {
    const template = `<div><t t-set="value" t-value="1">2</t><t t-esc="value"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("value priority (with non text body", () => {
    const template = `<div><t t-set="value" t-value="1"><span>2</span></t><t t-esc="value"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("evaluate value expression", () => {
    const template = `<div><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template)).toBe("<div>3</div>");
  });

  test("t-set with content and sub t-esc", () => {
    const template = `
      <div>
        <t t-set="setvar"><t t-esc="beep"/> boop</t>
        <t t-esc="setvar"/>
      </div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { beep: "beep" })).toBe("<div>beep boop</div>");
  });

  test("evaluate value expression, part 2", () => {
    const template = `<div><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></div>`;
    snapshotCompiledCode(template);
    expect(renderToString(template, { somevariable: 43 })).toBe("<div>45</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 1", () => {
    const template = `
      <div>
        <t t-if="flag" t-set="ourvar">1</t>
        <t t-else="" t-set="ourvar" t-value="0"></t>
        <t t-esc="ourvar"/>
      </div>`;
    snapshotCompiledCode(template);

    expect(renderToString(template, { flag: true })).toBe("<div>1</div>");
    expect(renderToString(template, { flag: false })).toBe("<div>0</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 2", () => {
    const template = `
      <div>
        <t t-if="flag" t-set="ourvar" t-value="1"></t>
        <t t-else="" t-set="ourvar">0</t>
        <t t-esc="ourvar"/>
      </div>`;
    snapshotCompiledCode(template);

    expect(renderToString(template, { flag: true })).toBe("<div>1</div>");
    expect(renderToString(template, { flag: false })).toBe("<div>0</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 3", () => {
    const template = `
        <t t-if="flag" t-set="ourvar" t-value="1"></t>
        <t t-else="" t-set="ourvar">0</t>
        <t t-esc="ourvar"/>`;
    snapshotCompiledCode(template);

    expect(renderToString(template, { flag: true })).toBe("1");
    expect(renderToString(template, { flag: false })).toBe("0");
  });

  test("t-set body is evaluated immediately", () => {
    const template = `
      <div>
        <t t-set="v1" t-value="'before'"/>
        <t t-set="v2">
          <span><t t-esc="v1"/></span>
        </t>
        <t t-set="v1" t-value="'after'"/>
        <t t-raw="v2"/>
      </div>`;
    snapshotCompiledCode(template);

    expect(renderToString(template)).toBe("<div><span>before</span></div>");
  });

  test("t-set with t-value (falsy) and body", () => {
    const template = `
      <div>
        <t t-set="v3" t-value="false"/>
        <t t-set="v1" t-value="'before'"/>
        <t t-set="v2" t-value="v3">
          <span><t t-esc="v1"/></span>
        </t>
        <t t-set="v1" t-value="'after'"/>
        <t t-set="v3" t-value="true"/>
        <t t-raw="v2"/>
      </div>`;
    snapshotCompiledCode(template);

    expect(renderToString(template)).toBe("<div><span>before</span></div>");
  });

  test("t-set with t-value (truthy) and body", () => {
    const template = `
      <div>
        <t t-set="v3" t-value="'Truthy'"/>
        <t t-set="v1" t-value="'before'"/>
        <t t-set="v2" t-value="v3">
          <span><t t-esc="v1"/></span>
        </t>
        <t t-set="v1" t-value="'after'"/>
        <t t-set="v3" t-value="false"/>
        <t t-raw="v2"/>
      </div>`;
    snapshotCompiledCode(template);

    expect(renderToString(template)).toBe("<div>Truthy</div>");
  });
});

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

describe("t-call (template calling)", () => {
  test("basic caller", () => {
    const templateSet = new TestTemplateSet();
    templateSet.add("_basic-callee", `<span>ok</span>`);
    templateSet.add("caller", `<div><t t-call="_basic-callee"/></div>`);

    snapshotCompiledCode(`<div><t t-call="_basic-callee"/></div>`);
    expect(templateSet.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const templateSet = new TestTemplateSet();
    templateSet.add("_basic-callee", `<span>ok</span>`);
    templateSet.add("caller", `<t t-call="_basic-callee"/>`);

    snapshotCompiledCode(`<t t-call="_basic-callee"/>`);
    expect(templateSet.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const templateSet = new TestTemplateSet();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub"/></div>`;
    templateSet.add("main", main);
    templateSet.add("sub", `<span t-esc="v"/>`);

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>Hi</span></div>");
  });

  test("t-call with t-if", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div><t t-if="flag" t-call="sub"/></div>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call allowed on a non t node", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div t-call="sub"/>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>ok</span></div>");
  });

  test("with unused body", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub">WHEEE</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub"><t t-set="qux" t-value="3"/></t>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub">ok</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotCompiledCode(main);
    snapshotCompiledCode(sub);
    expect(templateSet.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("with used setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub"><t t-set="foo" t-value="'ok'"/></t></span>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotCompiledCode(main);
    expect(templateSet.renderToString("main")).toBe("<span>ok</span>");
  });
});
