import { BDom } from "../src/bdom";
import { compile, TemplateSet } from "../src/qweb_compiler";
import { makeTestFixture, trim, snapshotTemplateCode } from "./helpers";

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
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("simple string in t tag", () => {
    const template = `<t>hello vdom</t>`;
    expect(renderToString(template)).toBe("hello vdom");
    snapshotTemplateCode(template);
  });

  test("empty string", () => {
    const template = ``;
    expect(renderToString(template)).toBe("");
    snapshotTemplateCode(template);
  });

  test("empty div", () => {
    const template = `<div></div>`;
    expect(renderToString(template)).toBe("<div></div>");
    snapshotTemplateCode(template);
  });

  test("div with content", () => {
    const template = `<div>foo</div>`;
    expect(renderToString(template)).toBe("<div>foo</div>");
    snapshotTemplateCode(template);
  });

  test("multiple root nodes", () => {
    const template = `<div>foo</div><span>hey</span>`;
    expect(renderToString(template)).toBe("<div>foo</div><span>hey</span>");
    snapshotTemplateCode(template);
  });

  test("dynamic text value", () => {
    const template = `<t><t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("owl");
    snapshotTemplateCode(template);
  });

  test("two t-escs next to each other", () => {
    const template = `<t><t t-esc="text1"/><t t-esc="text2"/></t>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
    snapshotTemplateCode(template);
  });

  test("two t-escs next to each other, in a div", () => {
    const template = `<div><t t-esc="text1"/><t t-esc="text2"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("<div>helloowl</div>");
  });

  test("static text and dynamic text", () => {
    const template = `<t>hello <t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotTemplateCode(template);
  });

  test("static text and dynamic text (no t tag)", () => {
    const template = `hello <t t-esc="text"/>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotTemplateCode(template);
  });

  test("t-esc in dom node", () => {
    const template = `<div><t t-esc="text"/></div>`;
    expect(renderToString(template, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template);
  });

  test("dom node with t-esc", () => {
    const template1 = `<div t-esc="text" />`;
    expect(renderToString(template1, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template1);
    const template2 = `<div t-esc="text"></div>`;
    expect(renderToString(template2, { text: "hello owl" })).toBe("<div>hello owl</div>");
  });

  test("t-esc in dom node, variations", () => {
    const template1 = `<div>hello <t t-esc="text"/></div>`;
    expect(renderToString(template1, { text: "owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template1);
    const template2 = `<div>hello <t t-esc="text"/> world</div>`;
    expect(renderToString(template2, { text: "owl" })).toBe("<div>hello owl world</div>");
    snapshotTemplateCode(template2);
  });

  test("div with a class attribute", () => {
    const template = `<div class="abc">foo</div>`;
    expect(renderToString(template)).toBe(`<div class="abc">foo</div>`);
    snapshotTemplateCode(template);
  });

  test("div with a class attribute with a quote", () => {
    const template = `<div class="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div class="a'bc">word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with an arbitrary attribute with a quote", () => {
    const template = `<div abc="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div abc="a'bc">word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with an empty class attribute", () => {
    const template = `<div class="">word</div>`;
    expect(renderToString(template)).toBe(`<div>word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with a span child node", () => {
    const template = `<div><span>word</span></div>`;
    expect(renderToString(template)).toBe("<div><span>word</span></div>");
    snapshotTemplateCode(template);
  });

  test("can render a table row", () => {
    const template = `<tr><td>cell</td></tr>`;
    expect(renderToString(template)).toBe(template);
    snapshotTemplateCode(template);
  });
});

// -----------------------------------------------------------------------------
// white space
// -----------------------------------------------------------------------------

describe("white space handling", () => {
  test("white space only text nodes are condensed into a single space", () => {
    const template = `<div>  </div>`;
    expect(renderToString(template)).toBe("<div> </div>");
    snapshotTemplateCode(template);
  });

  test("consecutives whitespaces are condensed into a single space", () => {
    const template = `<div>  abc  </div>`;
    expect(renderToString(template)).toBe("<div> abc </div>");
    snapshotTemplateCode(template);
  });

  test("whitespace only text nodes with newlines are removed", () => {
    const template = `<div>
        <span>abc</span>
      </div>`;

    expect(renderToString(template)).toBe("<div><span>abc</span></div>");
    snapshotTemplateCode(template);
  });

  test("nothing is done in pre tags", () => {
    const template1 = `<pre>   </pre>`;
    expect(renderToString(template1)).toBe(template1);

    const template2 = `<pre>
        some text
      </pre>`;
    snapshotTemplateCode(template2);
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
    snapshotTemplateCode(template);
  });

  test("properly handle comments between t-if/t-else", () => {
    const template = `
      <div>
        <span t-if="true">true</span>
        <!-- comment-->
        <span t-else="">owl</span>
      </div>`;
    expect(renderToString(template)).toBe("<div><span>true</span></div>");
    snapshotTemplateCode(template);
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

  test("dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("two dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'" t-att-bar="'foo'"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar" bar="foo"></div>`);
  });

  test("dynamic class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { c: "abc" });
    expect(result).toBe(`<div class="abc"></div>`);
  });

  test("dynamic empty class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { c: "" });
    expect(result).toBe(`<div></div>`);
  });

  test("dynamic attribute with a dash", () => {
    const template = `<div t-att-data-action-id="id"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div data-action-id="32"></div>`);
  });

  test("dynamic formatted attributes with a dash", () => {
    const template = `<div t-attf-aria-label="Some text {{id}}"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div aria-label="Some text 32"></div>`);
  });

  test("fixed variable", () => {
    const template = `<div t-att-foo="value"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe(`<div foo="ok"></div>`);
  });

  test("dynamic attribute falsy variable ", () => {
    const template = `<div t-att-foo="value"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { value: false });
    expect(result).toBe(`<div></div>`);
  });
});

// -----------------------------------------------------------------------------
// t-if
// -----------------------------------------------------------------------------

describe("t-if", () => {
  test("t-if in a div", () => {
    const template = `<div><t t-if="condition">ok</t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("<div>ok</div>");
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
    expect(renderToString(template, {})).toBe("<div></div>");
  });

  test("just a t-if", () => {
    const template = `<t t-if="condition">ok</t>`;
    expect(renderToString(template, { condition: true })).toBe("ok");
    expect(renderToString(template, { condition: false })).toBe("");
    snapshotTemplateCode(template);
  });

  test("a t-if with two inner nodes", () => {
    const template = `<t t-if="condition"><span>yip</span><div>yip</div></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("<span>yip</span><div>yip</div>");
    expect(renderToString(template, { condition: false })).toBe("");
  });

  test("div containing a t-if with two inner nodes", () => {
    const template = `<div><t t-if="condition"><span>yip</span><div>yip</div></t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>yip</span><div>yip</div></div>"
    );
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
  });

  test("two consecutive t-if", () => {
    const template = `<t t-if="cond1">1</t><t t-if="cond2">2</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("12");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("2");
  });

  test("a t-if next to a div", () => {
    const template = `<div>foo</div><t t-if="cond">1</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond: true })).toBe("<div>foo</div>1");
    expect(renderToString(template, { cond: false })).toBe("<div>foo</div>");
  });

  test("two consecutive t-if in a div", () => {
    const template = `<div><t t-if="cond1">1</t><t t-if="cond2">2</t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("<div>12</div>");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("<div>2</div>");
  });

  test("simple t-if/t-else", () => {
    const template = `<t t-if="condition">1</t><t t-else="">2</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("2");
  });

  test("simple t-if/t-else in a div", () => {
    const template = `<div><t t-if="condition">1</t><t t-else="">2</t></div>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template, { color: "red" })).toBe("<div>red is dead</div>");
  });

  test("boolean value condition elif (no outside node)", () => {
    const template = `
        <t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>begin</span>ok<span>end</span></div>"
    );
  });

  test("boolean value condition false else", () => {
    const template = `
      <div><span>begin</span><t t-if="condition">fail</t>
      <t t-else="">fail-else</t><span>end</span></div>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-esc with t-elif", () => {
    const template = `<div><t t-if="false">abc</t><t t-else="" t-esc="'x'"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-set, then t-if", () => {
    const template = `
      <div>
        <t t-set="title" t-value="'test'"/>
        <t t-if="title"><t t-esc="title"/></t>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>test</div>");
  });

  test("t-set, then t-if, part 2", () => {
    const template = `
      <div>
          <t t-set="y" t-value="true"/>
          <t t-set="x" t-value="y"/>
          <span t-if="x">COUCOU</span>
      </div>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div><span>BBB</span></div>");
  });

  test("t-if in a t-if", () => {
    const template = `<div><t t-if="cond1"><span>1<t t-if="cond2">2</t></span></t></div>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("<span>a</span><span>b</span>");
  });

  test("dynamic content after t-if with two children nodes", () => {
    const template = `<div><t t-if="condition"><p>1</p><p>2</p></t><t t-esc="text"/></div>`;
    snapshotTemplateCode(template);

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

  test("missing template", () => {
    const template = `<t t-call="othertemplate" />`;
    expect(() => renderToString(template)).toThrowError("Missing");
  });

  test("missing template in template set", () => {
    const templateSet = new TestTemplateSet();
    const template = `<t t-call="othertemplate" />`;

    templateSet.add("template", template);
    expect(() => templateSet.renderToString("template")).toThrowError("Missing");
  });
});

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

describe("t-esc", () => {
  test("literal", () => {
    const template = `<span><t t-esc="'ok'"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("escaping", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "<ok>abc</ok>" })).toBe(
      "<span>&lt;ok&gt;abc&lt;/ok&gt;</span>"
    );
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const template = `<span t-esc="'ok'">nope</span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const template = `<span t-esc="var">nope</span>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template, { state: { list: [1, 2] } })).toBe("<span>1,2</span>");
  });

  test("t-esc is escaped", () => {
    const template = `<div><t t-set="var"><p>escaped</p></t><t t-esc="var"/></div>`;
    snapshotTemplateCode(template);
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

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
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
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("literal, no outside html element", () => {
    const template = `<t t-raw="'ok'"/>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("variable", () => {
    const template = `<span><t t-raw="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const template = `<div><t t-raw="var"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "<ok></ok>" })).toBe("<div><ok></ok></div>");
  });

  test("t-raw and another sibling node", () => {
    const template = `<span><span>hello</span><t t-raw="var"/></span>`;
    snapshotTemplateCode(template);
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

  test("t-raw on a node with a body, as a default", () => {
    const template = `<span t-raw="var">nope</span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("t-raw on a node with a dom node in body, as a default", () => {
    const template = `<span t-raw="var"><div>nope</div></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span><div>nope</div></span>");
  });
});

// -----------------------------------------------------------------------------
// t-set
// -----------------------------------------------------------------------------

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>ok</div>");
  });

  test("set from attribute literal (no outside div)", () => {
    const template = `<t><t t-set="value" t-value="'ok'"/><t t-esc="value"/></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("t-set and t-if", () => {
    const template = `
      <div>
        <t t-set="v" t-value="value"/>
        <t t-if="v === 'ok'">grimbergen</t>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>grimbergen</div>");
  });

  test("set from body literal", () => {
    const template = `<t><t t-set="value">ok</t><t t-esc="value"/></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("set from attribute lookup", () => {
    const template = `<div><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("t-set evaluates an expression only once", () => {
    const template = `
      <div >
        <t t-set="v" t-value="value + ' artois'"/>
        <t t-esc="v"/>
        <t t-esc="v"/>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { value: "stella" })).toBe(
      "<div>stella artoisstella artois</div>"
    );
  });

  test("set from body lookup", () => {
    const template = `<div><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("set from empty body", () => {
    const template = `<div><t t-set="stuff"/><t t-esc="stuff"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div></div>");
  });

  test("value priority", () => {
    const template = `<div><t t-set="value" t-value="1">2</t><t t-esc="value"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("value priority (with non text body", () => {
    const template = `<div><t t-set="value" t-value="1"><span>2</span></t><t t-esc="value"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("evaluate value expression", () => {
    const template = `<div><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>3</div>");
  });

  test("t-set should reuse variable if possible", () => {
    const template = `
      <div>
        <t t-set="v" t-value="1"/>
        <div t-foreach="list" t-as="elem" t-key="elem_index">
            <span>v<t t-esc="v"/></span>
            <t t-set="v" t-value="elem"/>
        </div>
      </div>`;
    snapshotTemplateCode(template);
    const expected = "<div><div><span>v1</span></div><div><span>va</span></div></div>";
    expect(renderToString(template, { list: ["a", "b"] })).toBe(expected);
  });

  test("t-set with content and sub t-esc", () => {
    const template = `
      <div>
        <t t-set="setvar"><t t-esc="beep"/> boop</t>
        <t t-esc="setvar"/>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { beep: "beep" })).toBe("<div>beep boop</div>");
  });

  test("evaluate value expression, part 2", () => {
    const template = `<div><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { somevariable: 43 })).toBe("<div>45</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 1", () => {
    const template = `
      <div>
        <t t-if="flag" t-set="ourvar">1</t>
        <t t-else="" t-set="ourvar" t-value="0"></t>
        <t t-esc="ourvar"/>
      </div>`;
    snapshotTemplateCode(template);

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
    snapshotTemplateCode(template);

    expect(renderToString(template, { flag: true })).toBe("<div>1</div>");
    expect(renderToString(template, { flag: false })).toBe("<div>0</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 3", () => {
    const template = `
        <t t-if="flag" t-set="ourvar" t-value="1"></t>
        <t t-else="" t-set="ourvar">0</t>
        <t t-esc="ourvar"/>`;
    snapshotTemplateCode(template);

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
    snapshotTemplateCode(template);

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
    snapshotTemplateCode(template);

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
    snapshotTemplateCode(template);

    expect(renderToString(template)).toBe("<div>Truthy</div>");
  });
});

// -----------------------------------------------------------------------------
// t-foreach
// -----------------------------------------------------------------------------

describe("t-foreach", () => {
  test("simple iteration", () => {
    const template = `<t t-foreach="[3, 2, 1]" t-as="item"><t t-esc="item"/></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("321");
  });

  test("simple iteration (in a node)", () => {
    const template = `
      <div>
        <t t-foreach="[3, 2, 1]" t-as="item"><t t-esc="item"/></t>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>321</div>");
  });

  test("iterate on items", () => {
    const template = `
      <div>
        <t t-foreach="[3, 2, 1]" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
        </t>
      </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div> [0: 3 3]  [1: 2 2]  [2: 1 1] </div>");
  });

  test("iterate on items (on a element node)", () => {
    const template = `
      <div>
        <span t-foreach="[1, 2]" t-as="item" t-key="item"><t t-esc="item"/></span>
      </div>`;
    snapshotTemplateCode(template);
    const expected = `<div><span>1</span><span>2</span></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("iterate, position", () => {
    const template = `
      <div>
        <t t-foreach="Array(5)" t-as="elem">
          -<t t-if="elem_first"> first</t><t t-if="elem_last"> last</t> (<t t-esc="elem_index"/>)
        </t>
      </div>`;
    snapshotTemplateCode(template);
    const expected = `<div> - first (0)  - (1)  - (2)  - (3)  - last (4) </div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("iterate, dict param", () => {
    const template = `
      <div>
        <t t-foreach="value" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
        </t>
      </div>`;
    snapshotTemplateCode(template);
    const expected = `<div> [0: a 1]  [1: b 2]  [2: c 3] </div>`;
    const context = { value: { a: 1, b: 2, c: 3 } };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("does not pollute the rendering context", () => {
    const template = `
      <div>
        <t t-foreach="[1]" t-as="item"><t t-esc="item"/></t>
      </div>`;
    snapshotTemplateCode(template);
    const context = { __owl__: {} };
    renderToString(template, context);
    expect(Object.keys(context)).toEqual(["__owl__"]);
  });

  test("t-foreach in t-foreach", () => {
    const template = `
      <div>
        <t t-foreach="numbers" t-as="number">
          <t t-foreach="letters" t-as="letter">
            [<t t-esc="number"/><t t-esc="letter"/>]
          </t>
        </t>
      </div>`;

    snapshotTemplateCode(template);

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected = "<div> [1a]  [1b]  [2a]  [2b]  [3a]  [3b] </div>";
    expect(renderToString(template, context)).toBe(expected);
  });

  test("t-call without body in t-foreach in t-foreach", () => {
    const templateSet = new TestTemplateSet();
    const sub = `
      <t>
        <t t-set="c" t-value="'x' + '_' + a + '_'+ b" />
        [<t t-esc="a" />]
        [<t t-esc="b" />]
        [<t t-esc="c" />]
      </t>`;

    const main = `
      <div>
        <t t-foreach="numbers" t-as="a">
          <t t-foreach="letters" t-as="b">
            <t t-call="sub" />
          </t>
          <span t-esc="c"/>
        </t>
        <span>[<t t-esc="a" />][<t t-esc="b" />][<t t-esc="c" />]</span>
      </div>`;

    templateSet.add("sub", sub);
    templateSet.add("main", main);
    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected =
      "<div> [1] [a] [x_1_a]  [1] [b] [x_1_b] <span></span> [2] [a] [x_2_a]  [2] [b] [x_2_b] <span></span> [3] [a] [x_3_a]  [3] [b] [x_3_b] <span></span><span>[][][]</span></div>";
    expect(templateSet.renderToString("main", context)).toBe(expected);
  });

  test("t-call with body in t-foreach in t-foreach", () => {
    const templateSet = new TestTemplateSet();
    const sub = `
      <t>
        [<t t-esc="a" />]
        [<t t-esc="b" />]
        [<t t-esc="c" />]
      </t>`;

    const main = `
      <div>
        <t t-foreach="numbers" t-as="a">
          <t t-foreach="letters" t-as="b">
            <t t-call="sub" >
              <t t-set="c" t-value="'x' + '_' + a + '_'+ b" />
            </t>
          </t>
          <span t-esc="c"/>
        </t>
        <span>[<t t-esc="a" />][<t t-esc="b" />][<t t-esc="c" />]</span>
      </div>`;

    templateSet.add("sub", sub);
    templateSet.add("main", main);
    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected =
      "<div> [1] [a] [x_1_a]  [1] [b] [x_1_b] <span></span> [2] [a] [x_2_a]  [2] [b] [x_2_b] <span></span> [3] [a] [x_3_a]  [3] [b] [x_3_b] <span></span><span>[][][]</span></div>";
    expect(templateSet.renderToString("main", context)).toBe(expected);
  });

  test("throws error if invalid loop expression", () => {
    const test = `<div><t t-foreach="abc" t-as="item"><span t-key="item_index"/></t></div>`;
    expect(() => renderToString(test)).toThrow("Invalid loop expression");
  });

  test.skip("warn if no key in some case", () => {
    const consoleWarn = console.warn;
    console.warn = jest.fn();

    const template = `
      <div>
        <t t-foreach="[1, 2]" t-as="item">
          <span><t t-esc="item"/></span>
        </t>
      </div>`;
    renderToString(template);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Directive t-foreach should always be used with a t-key! (in template: 'test')"
    );
    console.warn = consoleWarn;
  });

  test("multiple calls to t-raw", () => {
    const templateSet = new TestTemplateSet();
    const sub = `
      <div>
        <t t-raw="0"/>
        <div>Greeter</div>
        <t t-raw="0"/>
      </div>`;

    const main = `
      <div>
        <t t-call="sub">
          <span>coucou</span>
        </t>
      </div>`;

    templateSet.add("sub", sub);
    templateSet.add("main", main);
    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);
    const expected =
      "<div><div><span>coucou</span><div>Greeter</div><span>coucou</span></div></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
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

    snapshotTemplateCode(`<div><t t-call="_basic-callee"/></div>`);
    expect(templateSet.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const templateSet = new TestTemplateSet();
    templateSet.add("_basic-callee", `<span>ok</span>`);
    templateSet.add("caller", `<t t-call="_basic-callee"/>`);

    snapshotTemplateCode(`<t t-call="_basic-callee"/>`);
    expect(templateSet.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const templateSet = new TestTemplateSet();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub"/></div>`;
    templateSet.add("main", main);
    templateSet.add("sub", `<span t-esc="v"/>`);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>Hi</span></div>");
  });

  test("t-call with t-if", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div><t t-if="flag" t-call="sub"/></div>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call allowed on a non t node", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div t-call="sub"/>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>ok</span></div>");
  });

  test("with unused body", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub">WHEEE</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub"><t t-set="qux" t-value="3"/></t>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub">ok</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    expect(templateSet.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("with used setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub"><t t-set="foo" t-value="'ok'"/></t></span>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<span>ok</span>");
  });

  test("inherit context", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `<div><t t-set="foo" t-value="1"/><t t-call="sub"/></div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>1</div>");
  });

  test("scoped parameters", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<t>ok</t>";
    const main = `
      <div>
        <t t-call="sub">
          <t t-set="foo" t-value="42"/>
        </t>
        <t t-esc="foo"/>
      </div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("scoped parameters, part 2", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `
      <div>
        <t t-set="foo" t-value="11"/>
        <t t-call="sub">
          <t t-set="foo" t-value="42"/>
        </t>
        <t t-esc="foo"/>
      </div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>4211</div>");
  });

  test("call with several sub nodes on same line", () => {
    const templateSet = new TestTemplateSet();
    const sub = `
      <div>
        <t t-raw="0"/>
      </div>`;
    const main = `
      <div>
        <t t-call="sub">
          <span>hey</span> <span>yay</span>
        </t>
      </div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);
    const expected = "<div><div><span>hey</span> <span>yay</span></div></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0'", () => {
    const templateSet = new TestTemplateSet();
    const finalTemplate = `
      <div>
        <span>cascade 2</span>
        <t t-raw="0"/>
      </div>`;

    const subSubTemplate = `
      <div>
        <t t-call="finalTemplate">
          <span>cascade 1</span>
          <t t-raw="0"/>
        </t>
      </div>`;

    const subTemplate = `
      <div>
        <t t-call="subSubTemplate">
          <span>cascade 0</span>
          <t t-raw="0"/>
        </t>
      </div>`;

    const main = `
      <div>
        <t t-call="subTemplate">
          <span>hey</span> <span>yay</span>
        </t>
      </div>`;

    templateSet.add("finalTemplate", finalTemplate);
    templateSet.add("subSubTemplate", subSubTemplate);
    templateSet.add("subTemplate", subTemplate);
    templateSet.add("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<div><div><div><div><span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span></div></div></div></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0', without external divs", () => {
    const templateSet = new TestTemplateSet();
    const finalTemplate = `
        <span>cascade 2</span>
        <t t-raw="0"/>`;

    const subSubTemplate = `
        <t t-call="finalTemplate">
          <span>cascade 1</span>
          <t t-raw="0"/>
        </t>`;

    const subTemplate = `
        <t t-call="subSubTemplate">
          <span>cascade 0</span>
          <t t-raw="0"/>
        </t>`;

    const main = `
        <t t-call="subTemplate">
          <span>hey</span> <span>yay</span>
        </t>`;

    templateSet.add("finalTemplate", finalTemplate);
    templateSet.add("subSubTemplate", subSubTemplate);
    templateSet.add("subTemplate", subTemplate);
    templateSet.add("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("recursive template, part 1", () => {
    const templateSet = new TestTemplateSet();
    const recursive = `
      <div>
        <span>hey</span>
        <t t-if="false">
          <t t-call="recursive"/>
        </t>
      </div>`;

    templateSet.add("recursive", recursive);

    snapshotTemplateCode(recursive);
    const expected = "<div><span>hey</span></div>";
    expect(templateSet.renderToString("recursive")).toBe(expected);
  });

  test("recursive template, part 2", () => {
    const templateSet = new TestTemplateSet();
    const Parent = `
      <div>
        <t t-call="nodeTemplate">
            <t t-set="node" t-value="root"/>
        </t>
      </div>`;

    const nodeTemplate = `
      <div>
        <p><t t-esc="node.val"/></p>
        <t t-foreach="node.children or []" t-as="subtree">
            <t t-call="nodeTemplate">
                <t t-set="node" t-value="subtree"/>
            </t>
        </t>
      </div>`;

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b" }, { val: "c" }] };
    const expected = "<div><div><p>a</p><div><p>b</p></div><div><p>c</p></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 3", () => {
    const templateSet = new TestTemplateSet();
    const Parent = `
      <div>
        <t t-call="nodeTemplate">
            <t t-set="node" t-value="root"/>
        </t>
      </div>`;

    const nodeTemplate = `
      <div>
        <p><t t-esc="node.val"/></p>
        <t t-foreach="node.children or []" t-as="subtree">
          <t t-call="nodeTemplate">
            <t t-set="node" t-value="subtree"/>
          </t>
      </t>
      </div>`;

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b", children: [{ val: "d" }] }, { val: "c" }] };
    const expected =
      "<div><div><p>a</p><div><p>b</p><div><p>d</p></div></div><div><p>c</p></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 4: with t-set recursive index", () => {
    const templateSet = new TestTemplateSet();
    const Parent = `
      <div>
        <t t-call="nodeTemplate">
          <t t-set="recursive_idx" t-value="1"/>
          <t t-set="node" t-value="root"/>
        </t>
      </div>`;

    const nodeTemplate = `
      <div>
        <t t-set="recursive_idx" t-value="recursive_idx + 1"/>
        <p><t t-esc="node.val"/> <t t-esc="recursive_idx"/></p>
        <t t-foreach="node.children or []" t-as="subtree">
          <t t-call="nodeTemplate">
            <t t-set="node" t-value="subtree"/>
          </t>
        </t>
      </div>`;

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = {
      val: "a",
      children: [{ val: "b", children: [{ val: "c", children: [{ val: "d" }] }] }],
    };
    const expected =
      "<div><div><p>a 2</p><div><p>b 3</p><div><p>c 4</p><div><p>d 5</p></div></div></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("t-call, conditional and t-set in t-call body", () => {
    const templateSet = new TestTemplateSet();
    const callee1 = `<div>callee1</div>`;
    const callee2 = `<div>callee2 <t t-esc="v"/></div>`;
    const caller = `
      <div>
        <t t-set="v1" t-value="'elif'"/>
        <t t-if="v1 === 'if'" t-call="callee1" />
        <t t-elif="v1 === 'elif'" t-call="callee2" >
          <t t-set="v" t-value="'success'" />
        </t>
      </div>`;

    templateSet.add("callee1", callee1);
    templateSet.add("callee2", callee2);
    templateSet.add("caller", caller);

    snapshotTemplateCode(caller);
    const expected = `<div><div>callee2 success</div></div>`;
    expect(templateSet.renderToString("caller")).toBe(expected);
  });

  test("t-call with t-set inside and outside", () => {
    const templateSet = new TestTemplateSet();
    const main = `
      <div>
        <t t-foreach="list" t-as="v">
          <t t-set="val" t-value="v.val"/>
          <t t-call="sub">
            <t t-set="val3" t-value="val*3"/>
          </t>
        </t>
      </div>`;
    const sub = `
      <t>
        <span t-esc="val3"/>
      </t>`;

    templateSet.add("main", main);
    templateSet.add("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><span>3</span><span>6</span><span>9</span></div>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(templateSet.renderToString("main", context)).toBe(expected);
  });

  test("t-call with t-set inside and outside. 2", () => {
    const templateSet = new TestTemplateSet();
    const main = `
      <div>
        <t t-foreach="list" t-as="v">
          <t t-set="val" t-value="v.val"/>
          <t t-call="sub">
            <t t-set="val3" t-value="val*3"/>
          </t>
        </t>
      </div>`;
    const sub = `
      <t>
        <span t-esc="val3"/>
        <t t-esc="w"/>
      </t>`;
    const wrapper = `<p><t t-set="w" t-value="'fromwrapper'"/><t t-call="main"/></p>`;

    templateSet.add("main", main);
    templateSet.add("sub", sub);
    templateSet.add("wrapper", wrapper);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected =
      "<p><div><span>3</span>fromwrapper<span>6</span>fromwrapper<span>9</span>fromwrapper</div></p>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(templateSet.renderToString("wrapper", context)).toBe(expected);
  });

  test("t-call with t-set inside and body text content", () => {
    const templateSet = new TestTemplateSet();
    const main = `
      <div>
        <t t-call="sub">
          <t t-set="val">yip yip</t>
        </t>
      </div>`;
    const sub = `<p><t t-esc="val"/></p>`;

    templateSet.add("main", main);
    templateSet.add("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><p>yip yip</p></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("t-call with body content as root of a template", () => {
    const templateSet = new TestTemplateSet();
    const antony = `<foo><t t-raw="0"/></foo>`;
    const main = `<t><t t-call="antony"><p>antony</p></t></t>`;
    templateSet.add("antony", antony);
    templateSet.add("main", main);
    const expected = "<foo><p>antony</p></foo>";
    snapshotTemplateCode(antony);
    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("dynamic t-call", () => {
    const templateSet = new TestTemplateSet();
    const foo = `<foo><t t-esc="val"/></foo>`;
    const bar = `<bar><t t-esc="val"/></bar>`;
    const main = `<div><t t-call="{{template}}"/></div>`;

    templateSet.add("foo", foo);
    templateSet.add("bar", bar);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    const expected1 = "<div><foo>foo</foo></div>";
    expect(templateSet.renderToString("main", { template: "foo", val: "foo" })).toBe(expected1);
    const expected2 = "<div><bar>quux</bar></div>";
    expect(templateSet.renderToString("main", { template: "bar", val: "quux" })).toBe(expected2);
  });
});

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

describe("misc", () => {
  test("global", () => {
    const templateSet = new TestTemplateSet();
    const _calleeAsc = `<año t-att-falló="'agüero'" t-raw="0"/>`;
    const _calleeUsesFoo = `<span t-esc="foo">foo default</span>`;
    const _calleeAscToto = `<div t-raw="toto">toto default</div>`;
    const caller = `
      <div>
        <t t-foreach="[4,5,6]" t-as="value">
          <span t-esc="value"/>
          <t t-call="_callee-asc">
            <t t-call="_callee-uses-foo">
                <t t-set="foo" t-value="'aaa'"/>
            </t>
            <t t-call="_callee-uses-foo"/>
            <t t-set="foo" t-value="'bbb'"/>
            <t t-call="_callee-uses-foo"/>
          </t>
        </t>
        <t t-call="_callee-asc-toto"/>
      </div>`;
    templateSet.add("_callee-asc", _calleeAsc);
    templateSet.add("_callee-uses-foo", _calleeUsesFoo);
    templateSet.add("_callee-asc-toto", _calleeAscToto);
    templateSet.add("caller", caller);

    snapshotTemplateCode(caller);
    snapshotTemplateCode(_calleeAscToto);
    snapshotTemplateCode(_calleeAsc);
    snapshotTemplateCode(_calleeUsesFoo);

    const result = trim(templateSet.renderToString("caller"));
    const expected = trim(`
      <div>
        <span>4</span>
        <año falló="agüero">
          <span>aaa</span>
          <span>foo default</span>
          <span>bbb</span>
        </año>

        <span>5</span>
        <año falló="agüero">
          <span>aaa</span>
          <span>foo default</span>
          <span>bbb</span>
        </año>

        <span>6</span>
        <año falló="agüero">
          <span>aaa</span>
          <span>foo default</span>
          <span>bbb</span>
        </año>

        <div>toto default</div>
      </div>
    `);
    expect(result).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// t-on
// -----------------------------------------------------------------------------

describe("t-on", () => {
  function mountToFixture(template: string, ctx: any): HTMLDivElement {
    const block = renderToBdom(template, ctx);
    const fixture = makeTestFixture();
    block.mount(fixture);
    return fixture;
  }

  test("can bind event handler", () => {
    const template = `<button t-on-click="add">Click</button>`;
    snapshotTemplateCode(template);
    let a = 1;
    const fixture = mountToFixture(template, { add: () => (a = 3) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(3);
  });

  test("can bind two event handlers", () => {
    const template = `
      <button t-on-click="handleClick" t-on-dblclick="handleDblClick">Click</button>`;
    snapshotTemplateCode(template);
    let steps: string[] = [];
    const fixture = mountToFixture(template, {
      handleClick() {
        steps.push("click");
      },
      handleDblClick() {
        steps.push("dblclick");
      },
    });
    expect(steps).toEqual([]);
    fixture.querySelector("button")!.click();
    expect(steps).toEqual(["click"]);
    fixture.querySelector("button")!.dispatchEvent(new Event("dblclick"));
    expect(steps).toEqual(["click", "dblclick"]);
  });

  test("can bind handlers with arguments", () => {
    const template = `<button t-on-click="add(5)">Click</button>`;
    snapshotTemplateCode(template);
    let a = 1;
    const fixture = mountToFixture(template, { add: (n: number) => (a = a + n) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(6);
  });

  test("can bind handlers with object arguments", () => {
    const template = `<button t-on-click="add({val: 5})">Click</button>`;
    snapshotTemplateCode(template);
    let a = 1;
    const fixture = mountToFixture(template, { add: ({ val }: any) => (a = a + val) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(6);
  });

  test("can bind handlers with empty  object", () => {
    expect.assertions(2);
    const template = `<button t-on-click="doSomething({})">Click</button>`;
    snapshotTemplateCode(template);
    const fixture = mountToFixture(template, {
      doSomething(arg: any) {
        expect(arg).toEqual({});
      },
    });
    fixture.querySelector("button")!.click();
  });

  test("can bind handlers with empty object (with non empty inner string)", () => {
    expect.assertions(2);
    const template = `<button t-on-click="doSomething({ })">Click</button>`;
    snapshotTemplateCode(template);
    const fixture = mountToFixture(template, {
      doSomething(arg: any) {
        expect(arg).toEqual({});
      },
    });
    fixture.querySelector("button")!.click();
  });

  test("can bind handlers with empty object (with non empty inner string)", () => {
    expect.assertions(2);
    const template = `
      <ul>
        <li t-foreach="['someval']" t-as="action" t-key="action_index">
          <a t-on-click="activate(action)">link</a>
        </li>
      </ul>`;
    snapshotTemplateCode(template);
    const fixture = mountToFixture(template, {
      activate(action: string) {
        expect(action).toBe("someval");
      },
    });
    fixture.querySelector("a")!.click();
  });

  test("handler is bound to proper owner", () => {
    expect.assertions(2);
    const template = `<button t-on-click="add">Click</button>`;
    snapshotTemplateCode(template);
    let owner = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const fixture = mountToFixture(template, owner);
    fixture.querySelector("button")!.click();
  });

  test("handler is bound to proper owner, part 2", () => {
    expect.assertions(2);
    const template = `
      <t t-foreach="[1]" t-as="value">
        <button t-on-click="add">Click</button>
      </t>`;
    snapshotTemplateCode(template);
    let owner = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const fixture = mountToFixture(template, owner);
    fixture.querySelector("button")!.click();
  });
});
