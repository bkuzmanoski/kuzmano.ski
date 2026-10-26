import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { GITHUB_GIST_LINK_TEXT } from "#/config/site.ts";
import { githubGistUrlOf } from "#/site/github-gists.ts";

import { CodeBlock } from "./code-block.tsx";
import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";
import { OpensInNewTabDescriptionProvider } from "./opens-in-new-tab-description-provider.tsx";

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

  fireEvent.click(screen.getByRole("button", { name: "Copy to Clipboard" }));

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
  expect(screen.getByRole("button", { name: "Copy to Clipboard" }).hasAttribute("disabled")).toBe(true);
});

test("the code block preserves the attributes set by the syntax highlighter on its `<pre>`", () => {
  const { container } = render(<CodeBlock className="shiki" tabIndex={0} />);
  const block = container.querySelector("pre")!;

  expect(block.className).toBe("shiki");
  expect(block.getAttribute("tabindex")).toBe("0");
});

test("the code block renders its `style` prop on its frame rather than its `<pre>`", () => {
  const { container } = render(<CodeBlock style={{ color: "red" }} />);

  expect((container.firstElementChild as HTMLElement).style.color).toBe("red");
  expect(container.querySelector("pre")!.hasAttribute("style")).toBe(false);
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
])("the header of a code block does not name a language when its `<code>` $description", ({ className }) => {
  const { container } = renderInEntry(
    <CodeBlock>
      <code className={className}>const answer = 42;</code>
    </CodeBlock>,
  );

  expect(container.textContent).toBe("const answer = 42;");
});

test("the header of a code block with a `<pre>` that has the `data-gist-id` attribute links to that gist in a new tab", () => {
  render(
    <OpensInNewTabDescriptionProvider>
      <CodeBlock data-gist-id="0123abcd">
        <code>const answer = 42;</code>
      </CodeBlock>
    </OpensInNewTabDescriptionProvider>,
  );

  const link = screen.getByRole("link", { name: GITHUB_GIST_LINK_TEXT, description: "Opens in a new tab" });

  expect(link.getAttribute("href")).toBe(githubGistUrlOf("0123abcd"));
  expect(link.getAttribute("target")).toBe("_blank");
});

test("the gist link of a code block has a `data-feed-text` attribute of its text followed by a period", () => {
  render(<CodeBlock data-gist-id="0123abcd" />);
  expect(screen.getByRole("link", { name: GITHUB_GIST_LINK_TEXT }).getAttribute("data-feed-text")).toBe(
    `${GITHUB_GIST_LINK_TEXT}.`,
  );
});

test("the header of a code block with a `<pre>` that does not have the `data-gist-id` attribute omits the gist link", () => {
  render(
    <CodeBlock>
      <code>const answer = 42;</code>
    </CodeBlock>,
  );
  expect(screen.queryByRole("link")).toBeNull();
});

test("the code block omits the `data-gist-id` attribute from its `<pre>`", () => {
  const { container } = render(<CodeBlock data-gist-id="0123abcd" />);
  expect(container.querySelector("pre")!.hasAttribute("data-gist-id")).toBe(false);
});

test("the language label of a code block is marked with the `data-feed-omit` attribute", () => {
  renderInEntry(
    <CodeBlock>
      <code className="language-typescript">const answer = 42;</code>
    </CodeBlock>,
  );

  const feedOmittedElement = screen.getByText("typescript").closest("[data-feed-omit]");

  expect(feedOmittedElement).not.toBeNull();
  expect(feedOmittedElement?.contains(screen.getByText("const answer = 42;"))).toBe(false);
});
