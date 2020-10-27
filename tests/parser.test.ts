import { parse, ASTType } from "../src/parser";

describe("qweb parser", () => {
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

  test("empty div", async () => {
    expect(parse("<div></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      content: null,
    });
  });

  test("div with some text", async () => {
    expect(parse("<div>some text</div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      content: { type: ASTType.Text, value: "some text" },
    });
  });

  test("div with some more content", async () => {
    expect(parse("<div>some text<span>inside</span></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      content: {
        type: ASTType.Multi,
        content: [
          { type: ASTType.Text, value: "some text" },
          {
            type: ASTType.DomNode,
            tag: "span",
            content: { type: ASTType.Text, value: "inside" },
          },
        ],
      },
    });
  });

  test("multiple root dom nodes", async () => {
    expect(parse("<div></div><span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.DomNode, tag: "div", content: null },
        { type: ASTType.DomNode, tag: "span", content: null },
      ],
    });
  });

  test("dom node next to text node", async () => {
    expect(parse("some text<span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.Text, value: "some text" },
        { type: ASTType.DomNode, tag: "span", content: null },
      ],
    });
  });
});
