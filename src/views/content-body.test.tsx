import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { expect, test, vi } from "vitest";

import type { MDXModule } from "#/content";
import styles from "#/content/content.module.css";
import * as headingAnchorFixture from "#/test-utils/heading-anchor.mdx";

import { ContentBody } from "./content-body";

vi.mock("#/lib/audio/scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

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
