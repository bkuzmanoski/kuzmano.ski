import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { observeRailClearances } from "./observe-rail-clearances.ts";

const SPACE_BEFORE_PX = 20;
const BODY_PADDING_BLOCK_END_PX = 44;

let resizeCallbacks: Array<() => void>;
let frameCallbacks: Array<() => void>;

beforeEach(() => {
  resizeCallbacks = [];
  frameCallbacks = [];

  vi.stubGlobal("CSS", { supports: (condition: string) => condition === "anchor-scope: all" });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }

      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frameCallbacks.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(() => undefined) } });
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element, pseudoElement) =>
      ({
        position: pseudoElement ? "static" : "relative",
        borderTopWidth: "0px",
        borderBlockEndWidth: "0px",
        marginBlockStart: `${SPACE_BEFORE_PX}px`,
        paddingBlockEnd: (element as HTMLElement).hasAttribute("data-content-body")
          ? `${BODY_PADDING_BLOCK_END_PX}px`
          : "0px",
      }) as CSSStyleDeclaration,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function placeElement(element: Element, top: number, bottom: number) {
  element.getBoundingClientRect = () => DOMRect.fromRect({ y: top, height: bottom - top });
}

function createBody(markup: string) {
  const body = document.createElement("div");

  body.setAttribute("data-content-body", "");
  body.innerHTML = markup;
  document.body.append(body);

  return body;
}

const railClearanceOf = (element: HTMLElement) => element.style.getPropertyValue("--content-body-rail-clearance");
const endRailClearanceOf = (body: HTMLElement) => body.style.getPropertyValue("--content-body-end-rail-clearance");

function resizeBody() {
  resizeCallbacks.forEach((callback) => callback());
  frameCallbacks.splice(0).forEach((callback) => callback());
}

describe("observeRailClearances", () => {
  test("sets `--content-body-rail-clearance` on a section heading to how far the rail asides before it extend past the top of its row", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <h2>A heading</h2>
    `);
    const [paragraph, group, heading] = body.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

    placeElement(body, 0, 500);
    placeElement(paragraph, 0, 100);
    placeElement(group.firstElementChild!, 0, 250);
    placeElement(heading, 120, 160);
    observeRailClearances(body);

    expect(railClearanceOf(heading)).toBe(`${250 - (120 - SPACE_BEFORE_PX)}px`);
  });

  test("sets `--content-body-rail-clearance` on an element whose `data-content-span` attribute is `wide`, and not on an element in the text column", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <p>A second paragraph.</p>
      <figure data-content-span="text">A figure in the text column.</figure>
      <figure data-content-span="wide">A wide figure.</figure>
    `);
    const [paragraph, group, secondParagraph, textFigure, wideFigure] = body.children as unknown as Array<HTMLElement>;

    placeElement(body, 0, 500);
    placeElement(paragraph!, 0, 100);
    placeElement(group!.firstElementChild!, 0, 250);
    placeElement(secondParagraph!, 120, 140);
    placeElement(textFigure!, 150, 170);
    placeElement(wideFigure!, 180, 300);
    observeRailClearances(body);

    expect(railClearanceOf(secondParagraph!)).toBe("");
    expect(railClearanceOf(textFigure!)).toBe("");
    expect(railClearanceOf(wideFigure!)).toBe(`${250 - (180 - SPACE_BEFORE_PX)}px`);
  });

  test("does not set `--content-body-rail-clearance` on an element when every rail item ends above its row", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <h2>A heading</h2>
    `);
    const [paragraph, group, heading] = body.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

    placeElement(body, 0, 500);
    placeElement(paragraph, 0, 100);
    placeElement(group.firstElementChild!, 0, 60);
    placeElement(heading, 120, 160);
    observeRailClearances(body);

    expect(railClearanceOf(heading)).toBe("");
  });

  test("sets `--content-body-end-rail-clearance` on the body to how far the rail items extend past its content box", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
    `);
    const [paragraph, group] = body.children as unknown as [HTMLElement, HTMLElement];
    const contentBottom = 100;

    placeElement(body, 0, contentBottom + BODY_PADDING_BLOCK_END_PX);
    placeElement(paragraph, 0, contentBottom);
    placeElement(group.firstElementChild!, 0, 250);
    observeRailClearances(body);

    expect(endRailClearanceOf(body)).toBe(`${250 - contentBottom}px`);
  });

  test("measures before it returns, and again in the frame after the body resizes", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <h2>A heading</h2>
    `);
    const [paragraph, group, heading] = body.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

    placeElement(body, 0, 500);
    placeElement(paragraph, 0, 100);
    placeElement(group.firstElementChild!, 0, 250);
    placeElement(heading, 120, 160);
    observeRailClearances(body);

    expect(railClearanceOf(heading)).toBe("150px");

    placeElement(group.firstElementChild!, 0, 300);
    resizeBody();

    expect(railClearanceOf(heading)).toBe("200px");
  });

  test("stops measuring after its cleanup runs", () => {
    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <h2>A heading</h2>
    `);
    const [paragraph, group, heading] = body.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

    placeElement(body, 0, 500);
    placeElement(paragraph, 0, 100);
    placeElement(group.firstElementChild!, 0, 250);
    placeElement(heading, 120, 160);
    observeRailClearances(body)?.();
    placeElement(group.firstElementChild!, 0, 300);
    resizeBody();

    expect(railClearanceOf(heading)).toBe("150px");
  });

  test("does not measure or return a cleanup where `anchor-scope` is not supported", () => {
    vi.stubGlobal("CSS", { supports: () => false });

    const body = createBody(`
      <p>A paragraph.</p>
      <div data-rail-asides><aside>An aside.</aside></div>
      <h2>A heading</h2>
    `);
    const [paragraph, group, heading] = body.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

    placeElement(body, 0, 500);
    placeElement(paragraph, 0, 100);
    placeElement(group.firstElementChild!, 0, 250);
    placeElement(heading, 120, 160);

    expect(observeRailClearances(body)).toBeUndefined();
    expect(railClearanceOf(heading)).toBe("");
    expect(endRailClearanceOf(body)).toBe("");
    expect(resizeCallbacks).toEqual([]);
  });
});
