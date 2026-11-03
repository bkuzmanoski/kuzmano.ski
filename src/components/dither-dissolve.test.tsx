import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { DitherDissolve, DitherDissolveText } from "./dither-dissolve.tsx";

const unitsOf = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[aria-hidden] > span")].map((unit) => [
    unit.textContent,
    unit.style.getPropertyValue("--dither-dissolve-unit-index"),
  ]);

test("`DitherDissolve` renders its children, passes its other props to its `<div>`, and adds the `className` prop to its own class", () => {
  const { container } = render(
    <DitherDissolve className="fixture-class" data-testid="fixture">
      Fixture content.
    </DitherDissolve>,
  );
  const dissolve = container.firstElementChild;

  expect(screen.getByText("Fixture content.")).toBe(dissolve);
  expect(dissolve?.getAttribute("data-testid")).toBe("fixture");
  expect(dissolve?.classList).toContain("fixture-class");
  expect(dissolve?.classList.length).toBeGreaterThan(1);
});

test("`DitherDissolveText` numbers each character in reading order, and renders the whitespace between words outside its units", () => {
  const { container } = render(<DitherDissolveText>{"A  title"}</DitherDissolveText>);

  expect(unitsOf(container)).toEqual([
    ["A", "0"],
    ["t", "1"],
    ["i", "2"],
    ["t", "3"],
    ["l", "4"],
    ["e", "5"],
  ]);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("A  title");
});

test("`DitherDissolveText` renders a character with a combining mark as one unit", () => {
  const { container } = render(<DitherDissolveText>{"e\u0301x"}</DitherDissolveText>);
  expect(unitsOf(container)).toEqual([
    ["e\u0301", "0"],
    ["x", "1"],
  ]);
});

test("`DitherDissolveText` numbers each word when the `by` prop is `word`", () => {
  const { container } = render(<DitherDissolveText by="word">A longer title</DitherDissolveText>);
  expect(unitsOf(container)).toEqual([
    ["A", "0"],
    ["longer", "1"],
    ["title", "2"],
  ]);
});

test("`DitherDissolveText` hides its units from assistive technologies and omits them from a feed, and provides its text in the `data-text` and `data-feed-text` attributes of a copy without text content", () => {
  const { container } = render(<DitherDissolveText>A title</DitherDissolveText>);
  const units = container.querySelector("[aria-hidden='true']");
  const accessibleText = container.querySelector("[data-text]");

  expect(units?.hasAttribute("data-feed-omit")).toBe(true);
  expect(accessibleText?.getAttribute("data-text")).toBe("A title");
  expect(accessibleText?.getAttribute("data-feed-text")).toBe("A title");
  expect(accessibleText?.textContent).toBe("");
});

test("`DitherDissolveText` passes its other props to its outer `<span>`", () => {
  const { container } = render(
    <DitherDissolveText className="fixture-class" data-testid="fixture">
      A title
    </DitherDissolveText>,
  );
  const outerElement = container.firstElementChild;

  expect(outerElement?.getAttribute("data-testid")).toBe("fixture");
  expect(outerElement?.classList).toContain("fixture-class");
});
