import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block.tsx";
import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";

import type { ReactNode } from "react";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderInEntry = (codeBlock: ReactNode) => render(<EntryClipboardProvider>{codeBlock}</EntryClipboardProvider>);

test("the control copies the source of the code block it belongs to", async () => {
  renderInEntry(
    <CodeBlock>
      <code>
        <span>const answer</span>
        <span> = 42;</span>
      </code>
    </CodeBlock>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

  await act(async () => {
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith("const answer = 42;");
});

test("the control is disabled outside an entry", () => {
  render(
    <CodeBlock>
      <code>const answer = 42;</code>
    </CodeBlock>,
  );
  expect(screen.getByRole("button", { name: "Copy to clipboard" }).hasAttribute("disabled")).toBe(true);
});

test("the code block preserves the attributes set by the syntax highlighter", () => {
  const { container } = render(<CodeBlock className="shiki" style={{ color: "red" }} tabIndex={0} />);
  const block = container.querySelector("pre")!;

  expect(block.className).toBe("shiki");
  expect(block.style.color).toBe("red");
  expect(block.getAttribute("tabindex")).toBe("0");
});

test("the header of a code block names the language from the `language-` class of its `<code>`", () => {
  renderInEntry(
    <CodeBlock>
      <code className="shiki-code language-typescript">const answer = 42;</code>
    </CodeBlock>,
  );
  expect(screen.getByText("typescript").closest("pre")).toBeNull();
});

test.each([
  { description: "has no `language-` class", className: undefined },
  { description: "has a `language-` class without a language after it", className: "language-" },
])("the header of a code block whose `<code>` $description names no language", ({ className }) => {
  const { container } = renderInEntry(
    <CodeBlock>
      <code className={className}>const answer = 42;</code>
    </CodeBlock>,
  );

  expect(container.textContent).toBe("const answer = 42;");
});

test("the header of a code block is marked with the `data-feed-omit` attribute", () => {
  renderInEntry(
    <CodeBlock>
      <code className="language-typescript">const answer = 42;</code>
    </CodeBlock>,
  );

  const feedOmittedElement = screen.getByRole("button", { name: "Copy to clipboard" }).closest("[data-feed-omit]");

  expect(feedOmittedElement?.contains(screen.getByText("typescript"))).toBe(true);
  expect(feedOmittedElement?.contains(screen.getByText("const answer = 42;"))).toBe(false);
});
