import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block.tsx";

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

test("the control copies the source of the code block it belongs to", async () => {
  render(
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

test("the code block keeps the attributes set by the syntax highlighter", () => {
  const { container } = render(<CodeBlock className="shiki" style={{ color: "red" }} tabIndex={0} />);
  const block = container.querySelector("pre")!;

  expect(block.className).toBe("shiki");
  expect(block.getAttribute("tabindex")).toBe("0");
});
