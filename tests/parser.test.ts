import { ASTType, parse } from "../src/parser";

describe("qweb parser", () => {
  // ---------------------------------------------------------------------------
  // texts and basic stuff
  // ---------------------------------------------------------------------------

  test("simple text node", async () => {
    expect(parse("foo")).toEqual({
      type: ASTType.Text,
      value: "foo",
    });
  });

  test("text in t tag", async () => {
    expect(parse("<t>foo</t>")).toEqual({
      type: ASTType.Text,
      value: "foo",
    });
  });

  test("empty string", async () => {
    expect(parse("")).toEqual({
      type: ASTType.Text,
      value: "",
    });
  });

  test("white spaces are condensed into a single space", async () => {
    expect(parse("   ")).toEqual({
      type: ASTType.Text,
      value: " ",
    });
  });

  test("white spaces only text nodes with newlines are removed", async () => {
    const template = `
      <div>  
      </div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      content: [],
      attrs: {},
    });
  });

  test("empty string in t tag", async () => {
    expect(parse("<t></t>")).toEqual({
      type: ASTType.Text,
      value: "",
    });
  });

  test("simple comment node", async () => {
    expect(parse("<!-- comment -->")).toEqual({
      type: ASTType.Comment,
      value: " comment ",
    });
  });

  test("empty div", async () => {
    expect(parse("<div></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [],
    });
  });

  test("div with some text", async () => {
    expect(parse("<div>some text</div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [{ type: ASTType.Text, value: "some text" }],
    });
  });

  test("div with some more content", async () => {
    expect(parse("<div>some text<span>inside</span></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [
        { type: ASTType.Text, value: "some text" },
        {
          type: ASTType.DomNode,
          tag: "span",
          attrs: {},
          content: [{ type: ASTType.Text, value: "inside" }],
        },
      ],
    });
  });

  test("multiple root dom nodes", async () => {
    expect(parse("<div></div><span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.DomNode, tag: "div", attrs: {}, content: [] },
        { type: ASTType.DomNode, tag: "span", attrs: {}, content: [] },
      ],
    });
  });

  test("dom node next to text node", async () => {
    expect(parse("some text<span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.Text, value: "some text" },
        { type: ASTType.DomNode, tag: "span", attrs: {}, content: [] },
      ],
    });
  });

  test("dom node with class attribute", async () => {
    expect(parse(`<div class="abc">foo</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: { class: "abc" },
      content: [{ type: ASTType.Text, value: "foo" }],
    });
  });

  // ---------------------------------------------------------------------------
  // t-esc
  // ---------------------------------------------------------------------------

  test("t-esc node", async () => {
    expect(parse(`<t t-esc="text"/>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "",
    });
    expect(parse(`<t><t t-esc="text"/></t>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "",
    });
  });

  test("dom node with t-esc", async () => {
    expect(parse(`<span t-esc="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "span",
      attrs: {},
      content: [{ type: ASTType.TEsc, expr: "text", defaultValue: "" }],
    });
  });

  test("t-esc node with default value", async () => {
    expect(parse(`<t t-esc="text">hey</t>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "hey",
    });
  });

  test("dom node with t-esc with default value", async () => {
    expect(parse(`<div t-esc="text">hey</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [{ type: ASTType.TEsc, expr: "text", defaultValue: "hey" }],
    });
  });

  // ---------------------------------------------------------------------------
  // t-raw
  // ---------------------------------------------------------------------------

  test("t-raw node", async () => {
    expect(parse(`<t t-raw="text"/>`)).toEqual({
      type: ASTType.TRaw,
      expr: "text",
      body: null,
    });
  });

  test("t-raw node on a dom node", async () => {
    expect(parse(`<div t-raw="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [{ type: ASTType.TRaw, expr: "text", body: null }],
    });
  });

  test("t-raw node with body", async () => {
    expect(parse(`<div t-raw="text">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [
        { type: ASTType.TRaw, expr: "text", body: [{ type: ASTType.Text, value: "body" }] },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-if
  // ---------------------------------------------------------------------------

  test("t-if", async () => {
    expect(parse(`<div><t t-if="condition">hey</t></div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [
        {
          type: ASTType.TIf,
          condition: "condition",
          content: {
            type: ASTType.Text,
            value: "hey",
          },
          tElif: null,
          tElse: null,
        },
      ],
    });
  });

  test("t-if (on dom node", async () => {
    expect(parse(`<div t-if="condition">hey</div>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        attrs: {},
        content: [{ type: ASTType.Text, value: "hey" }],
      },
      tElif: null,
      tElse: null,
    });
  });

  test("t-if and t else", async () => {
    expect(parse(`<t t-if="condition">hey</t><t t-else="">else</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: null,
      tElse: {
        type: ASTType.Text,
        value: "else",
      },
    });
  });

  test("t-if and t elif", async () => {
    expect(parse(`<t t-if="condition">hey</t><t t-elif="cond2">elif</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: [
        {
          condition: "cond2",
          content: { type: ASTType.Text, value: "elif" },
        },
      ],
      tElse: null,
    });
  });

  test("t-if, t-elif and t-else", async () => {
    expect(parse(`<t t-if="c1">hey</t><t t-elif="c2">elif</t><t t-else="">else</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "c1",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: [
        {
          condition: "c2",
          content: { type: ASTType.Text, value: "elif" },
        },
      ],
      tElse: {
        type: ASTType.Text,
        value: "else",
      },
    });
  });

  test("t-if, t-elif and t-else on a node", async () => {
    expect(
      parse(`<div t-if="c1">hey</div><h1 t-elif="c2">elif</h1><h2 t-else="">else</h2>`)
    ).toEqual({
      type: ASTType.TIf,
      condition: "c1",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        attrs: {},
        content: [
          {
            type: ASTType.Text,
            value: "hey",
          },
        ],
      },
      tElif: [
        {
          condition: "c2",
          content: {
            type: ASTType.DomNode,
            tag: "h1",
            attrs: {},
            content: [{ type: ASTType.Text, value: "elif" }],
          },
        },
      ],
      tElse: {
        type: ASTType.DomNode,
        tag: "h2",
        attrs: {},
        content: [
          {
            type: ASTType.Text,
            value: "else",
          },
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-set
  // ---------------------------------------------------------------------------

  test("simple t-set expression", async () => {
    expect(parse(`<t t-set="key" t-value="value" />`)).toEqual({
      type: ASTType.TSet,
      name: "key",
      value: "value",
      defaultValue: null,
      body: null,
    });
  });

  test("t-set expression with body", async () => {
    expect(parse(`<t t-set="key">ok</t>`)).toEqual({
      type: ASTType.TSet,
      name: "key",
      defaultValue: "ok",
      value: null,
      body: null,
    });

    expect(parse(`<t t-set="v"><div>ok</div></t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: {},
          tag: "div",
          content: [{ type: ASTType.Text, value: "ok" }],
        },
      ],
    });

    expect(parse(`<t t-set="v"><div>ok</div>abc</t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: {},
          tag: "div",
          content: [{ type: ASTType.Text, value: "ok" }],
        },
        { type: ASTType.Text, value: "abc" },
      ],
    });
  });

  test("t-if and t-set expression with body", async () => {
    expect(parse(`<t t-if="flag" t-set="key">ok</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "flag",
      content: {
        type: ASTType.TSet,
        name: "key",
        defaultValue: "ok",
        value: null,
        body: null,
      },
      tElif: null,
      tElse: null,
    });
  });

  test("t-if, t-else and t-set", async () => {
    expect(
      parse(`<div><t t-if="flag">1</t><t t-else="" t-set="ourvar" t-value="0"></t></div>`)
    ).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [
        {
          type: ASTType.TIf,
          condition: "flag",
          content: { type: ASTType.Text, value: "1" },
          tElif: null,
          tElse: { type: ASTType.TSet, name: "ourvar", value: "0", defaultValue: null, body: null },
        },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-foreach
  // ---------------------------------------------------------------------------

  test("simple t-foreach expression", async () => {
    expect(parse(`<t t-foreach="list" t-as="item"><t t-esc="item"/></t>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
    });
  });

  test("t-foreach expression on a span", async () => {
    expect(parse(`<span t-foreach="list" t-as="item"><t t-esc="item"/></span>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      body: {
        type: ASTType.DomNode,
        tag: "span",
        attrs: {},
        content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
      },
    });
  });

  test("simple t-key expression", async () => {
    expect(parse(`<t t-key="k">abc</t>`)).toEqual({
      type: ASTType.TKey,
      expr: "k",
      content: { type: ASTType.Text, value: "abc" },
    });
  });

  test("t-foreach expression on a span with a t-key", async () => {
    expect(
      parse(`<span t-foreach="list" t-as="item" t-key="item_index"><t t-esc="item"/></span>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      body: {
        type: ASTType.TKey,
        expr: "item_index",
        content: {
          type: ASTType.DomNode,
          tag: "span",
          attrs: {},
          content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
        },
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-call
  // ---------------------------------------------------------------------------

  test("simple t-call expression", async () => {
    expect(parse(`<t t-call="blabla" />`)).toEqual({
      type: ASTType.TCall,
      name: "blabla",
      body: null,
    });
  });

  test("t-call with body", async () => {
    expect(parse(`<t t-call="sub">ok</t>`)).toEqual({
      type: ASTType.TCall,
      name: "sub",
      body: [{ type: ASTType.Text, value: "ok" }],
    });
  });

  test("t-call on a div node", async () => {
    expect(parse(`<div t-call="blabla" />`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      content: [
        {
          type: ASTType.TCall,
          name: "blabla",
          body: null,
        },
      ],
    });
  });
});
