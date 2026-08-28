import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { MDXModule } from "#/content";
import styles from "#/content/content.module.css";
import * as headingAnchorFixture from "#/test-utils/heading-anchor.mdx";

import { ContentBody } from "./content-body";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

beforeEach(() => {
  scrollIntoViewSilently.mockClear();
});

afterEach(() => {
  window.location.hash = "";
});

const renderContent = async (module: MDXModule) => {
  const { container } = await act(() =>
    render(
      <Suspense>
        <ContentBody content={Promise.resolve(module)} />
      </Suspense>,
    ),
  );

  return container.querySelector("article")!;
};

test("content is rendered into an article carrying the shared content class", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });

  expect(screen.getByText("Body")).toBeDefined();
  expect(article.className).toBe(styles.content);
});

test("a page's own class is applied alongside the shared one", async () => {
  const article = await renderContent({ default: () => <p>Body</p>, className: "aboutPage" });
  expect(article.className.split(" ")).toEqual([styles.content, "aboutPage"]);
});

test("every heading is followed by a named link to itself that is accessible to assistive technology", async () => {
  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: "Link to Fixture heading" });

  expect(link.getAttribute("href")).toBe("#fixture-heading");
  expect(link.closest("[aria-hidden]")).toBeNull(); // An `aria-hidden` link is invalid the moment a click focuses it.
  expect(link.closest("h1")).not.toBeNull();
  expect(screen.getByRole("link", { name: "Link to Fixture section" })).toBeDefined();
});

test("a page opened at a fragment scrolls to the section it names", async () => {
  window.location.hash = "#fixture-section";

  await renderContent(headingAnchorFixture);

  const section = screen.getByRole("heading", { name: /Fixture section/ });

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(section, { block: "start" });
  expect(document.activeElement).toBe(section);
});

test("a page opened at a fragment that does not name a section does not scroll", async () => {
  window.location.hash = "#absent-section";

  await renderContent(headingAnchorFixture);

  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("a page opened without a fragment does not scroll", async () => {
  await renderContent(headingAnchorFixture);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});
