import { parse, ASTType } from "../src/parser";

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
    });
    expect(parse(`<t><t t-esc="text"/></t>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
    });
  });

  test("dom node with t-esc", async () => {
    expect(parse(`<span t-esc="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "span",
      attrs: {},
      content: [{ type: ASTType.TEsc, expr: "text" }],
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
          content: [
            {
              type: ASTType.Text,
              value: "hey",
            },
          ],
        },
      ],
    });
  });

  test("t-if (on dom node", async () => {
    expect(parse(`<div t-if="condition">hey</div>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: [
        {
          type: ASTType.DomNode,
          tag: "div",
          attrs: {},
          content: [{ type: ASTType.Text, value: "hey" }],
        },
      ],
    });
  });
});
