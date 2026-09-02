import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetTooltipState } from "#/lib/tooltip";
import type { MDXModule } from "#/site/catalog";
import { canonicalUrl } from "#/site/metadata";
import * as headingAnchorFixture from "#/test-utils/fixtures/heading-anchor.mdx";

import { ContentBody } from "./content-body";
import styles from "./content-body.module.css";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());
const writeText = vi.fn<(value: string) => Promise<void>>();

Object.defineProperty(navigator, "clipboard", { value: { writeText } });

vi.mock("#/lib/audio/scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);
vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

const ROUTE = "/collection/fixture";
const TITLE = "Fixture Title";

beforeEach(() => {
  resetTooltipState();
  scrollIntoViewSilently.mockClear();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  window.location.hash = "";
});

const renderContent = async (module: MDXModule) => {
  const { container } = await act(() =>
    render(
      <Suspense>
        <ContentBody route={ROUTE} title={TITLE} content={Promise.resolve(module)} />
      </Suspense>,
    ),
  );

  return container.querySelector("article")!;
};

test("content is rendered into an article with the shared content class", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });

  expect(screen.getByText("Body")).toBeDefined();
  expect(article.className).toBe(styles.content);
});

test("a page's own class is applied alongside the shared one", async () => {
  const article = await renderContent({ default: () => <p>Body</p>, className: "aboutPage" });
  expect(article.className.split(" ")).toEqual([styles.content, "aboutPage"]);
});

test("the title heads the article, from the frontmatter rather than the body", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });
  const heading = screen.getByRole("heading", { level: 1 });

  expect(heading.textContent).toBe(TITLE);
  expect(article.firstElementChild).toBe(heading);
  expect(heading.hasAttribute("data-feed-omit")).toBe(true); // A feed reader renders the entry's title itself, so the body must not repeat it.
});

test("every heading is followed by a named link to itself that is accessible to assistive technology", async () => {
  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: 'Link to "Fixture Heading"' });

  expect(link.getAttribute("href")).toBe("#fixture-heading");
  expect(link.closest("[aria-hidden]")).toBeNull(); // An `aria-hidden` link is invalid the moment a click focuses it.
  expect(link.closest("h2")).not.toBeNull();
  expect(screen.getByRole("link", { name: 'Link to "Fixture Heading"' })).toBeDefined();
});

test("a page opened at a fragment scrolls to the heading it names", async () => {
  window.location.hash = "#fixture-heading";

  await renderContent(headingAnchorFixture);

  const heading = screen.getByRole("heading", { name: /Fixture Heading/ });

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(heading, { block: "start" });
  expect(document.activeElement).toBe(heading);
});

test("a page opened at a fragment that does not name a heading does not scroll", async () => {
  window.location.hash = "#absent-heading";

  await renderContent(headingAnchorFixture);

  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("a page opened without a fragment does not scroll", async () => {
  await renderContent(headingAnchorFixture);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("clicking a heading link copies the heading's address and shows the confirmation", async () => {
  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: 'Link to "Fixture Heading"' });

  await act(async () => {
    fireEvent.click(link);
    await Promise.resolve();
  });

  const heading = screen.getByRole("heading", { name: /Fixture Heading/ });

  expect(writeText).toHaveBeenCalledWith(canonicalUrl(`${ROUTE}#fixture-heading`));
  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(within(heading).getByRole("status").textContent).toBe("Copied"); // Announced by the pressed link, not by every heading.
});

test("clicking a heading link does not scroll the heading into view", async () => {
  await renderContent(headingAnchorFixture);

  fireEvent.click(screen.getByRole("link", { name: 'Link to "Fixture Heading"' }));

  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("a copy failure displays an alert and no confirmation", async () => {
  writeText.mockRejectedValue(new Error("Denied"));

  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: 'Link to "Fixture Heading"' });

  await act(async () => {
    fireEvent.click(link);
    await Promise.resolve();
  });

  expect(screen.getByRole("dialog").textContent).toContain("The link couldn’t be copied."); // One alert shared by the article, not one per heading.
  expect(screen.queryByRole("tooltip")).toBeNull(); // The tooltip only displays the successful-copy confirmation.

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
});
