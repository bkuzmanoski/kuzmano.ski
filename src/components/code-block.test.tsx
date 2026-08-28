import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block";

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal),
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

test("the control copies the source of the block it belongs to", async () => {
  render(
    <CodeBlock>
      <code>
        <span>const answer</span>
        <span> = 42;</span>
      </code>
    </CodeBlock>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

  await act(async () => {
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith("const answer = 42;");
});

test("the block keeps the attributes the set by the syntax highlighter", () => {
  const { container } = render(<CodeBlock className="shiki" style={{ color: "red" }} tabIndex={0} />);
  const block = container.querySelector("pre")!;

  expect(block.className).toBe("shiki");
  expect(block.getAttribute("tabindex")).toBe("0");
});

test("the wrapper uses its class while the block keeps the syntax highlighter's class", () => {
  const { container } = render(<CodeBlock className="shiki" containerClassName="content-code-block" />);
  const wrapper = container.firstElementChild!;

  expect(wrapper.className).toContain("content-code-block");
  expect(container.querySelector("pre")!.className).toBe("shiki");
});
