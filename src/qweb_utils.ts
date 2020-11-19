import { BDom } from "./bdom";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toDom(node: ChildNode): HTMLElement | Text | Comment {
  switch (node.nodeType) {
    case 1: {
      // HTMLElement
      if ((node as Element).tagName === "owl-text") {
        return document.createTextNode("");
      }
      const result = document.createElement((node as Element).tagName);
      const attrs = (node as Element).attributes;
      for (let i = 0; i < attrs.length; i++) {
        result.setAttribute(attrs[i].name, attrs[i].value);
      }
      for (let child of (node as Element).childNodes) {
        result.appendChild(toDom(child));
      }
      return result;
    }
    case 3: {
      // text node
      return document.createTextNode(node.textContent!);
    }
    case 8: {
      // comment node
      return document.createComment(node.textContent!);
    }
  }
  throw new Error("boom");
}

function elem(html: string): HTMLElement | Text | Comment {
  const doc = new DOMParser().parseFromString(html, "text/xml");
  return toDom(doc.firstChild!);
}

function toString(value: any): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return String(value);
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return "";
    case "object":
      return value ? value.toString() : "";
  }
  throw new Error("not yet working" + value);
}

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function call(name: string): BDom {
  throw new Error(`Missing template: "${name}"`);
}

function getValues(collection: any): [any[], any[], number] {
  if (Array.isArray(collection)) {
    return [collection, collection, collection.length];
  } else if (collection) {
    const keys = Object.keys(collection);
    return [keys, Object.values(collection), keys.length];
  }
  throw new Error("Invalid loop expression");
}

export const UTILS = {
  elem,
  toString,
  withDefault,
  call,
  zero: Symbol("zero"),
  getValues,
};
