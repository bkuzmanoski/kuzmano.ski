import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Suspense, useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { STATE_DISPLAY_DURATION_MS, resetTooltipState } from "#/lib/tooltip.ts";
import type { MDXModule } from "#/site/catalog.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import { descriptionTextOf } from "#/test-utils/accessibility.ts";
import { deferWrite } from "#/test-utils/clipboard.ts";
import * as codeBlocksFixture from "#/test-utils/fixtures/code-blocks.mdx";
import * as contentElementsFixture from "#/test-utils/fixtures/content-elements.mdx";
import * as headingAnchorFixture from "#/test-utils/fixtures/heading-anchor.mdx";
import * as linksFixture from "#/test-utils/fixtures/links.mdx";
import { RouterContext } from "#/test-utils/router-context.tsx";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import calloutStyles from "./callout.module.css";
import { CodeBlock } from "./code-block.tsx";
import styles from "./content-body.module.css";
import { ContentBody } from "./content-body.tsx";
import { EntrySectionHeading } from "./entry-section-heading.tsx";

import type { RenderOptions } from "@testing-library/react";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());
const playClick = vi.hoisted(() => vi.fn());
const writeText = vi.fn<(value: string) => Promise<void>>();

Object.defineProperty(navigator, "clipboard", { value: { writeText } });

vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playClick }),
);

const ROUTE = "/collection/fixture";
const TITLE = "Fixture Title";
const HEADINGS = [
  { tagName: "h2", title: "Fixture Heading", id: "fixture-heading" },
  { tagName: "h3", title: "Fixture Subheading", id: "fixture-subheading" },
];
const LINKS = ["fragment link", "internal link", "external link", "email link"];

beforeEach(() => {
  resetTooltipState();
  scrollIntoViewSilently.mockClear();
  playClick.mockClear();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = "";
});

const RENDER_OPTIONS: RenderOptions = { wrapper: RouterContext };

const renderContent = async (module: MDXModule) => {
  const { container } = await act(() =>
    render(
      <Suspense>
        <ContentBody route={ROUTE} title={TITLE} content={Promise.resolve(module)} />
      </Suspense>,
      RENDER_OPTIONS,
    ),
  );

  return container.querySelector("article")!;
};
const headingLinkName = (title: string) => `Copy link to ${title} section`;
const copyFrom = async (copyControl: HTMLElement) => {
  fireEvent.click(copyControl);

  await act(async () => {
    await Promise.resolve();
  });
};

function RemovableCodeBlock() {
  const [isShown, setIsShown] = useState(true);
  return (
    <>
      {isShown && (
        <CodeBlock>
          <code>const first = 1;</code>
        </CodeBlock>
      )}
      <button type="button" onClick={() => setIsShown(false)}>
        Remove
      </button>
    </>
  );
}

test("the `<article>` contains the entry's content and has only the shared content class", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });

  expect(screen.getByText("Body")).toBeDefined();
  expect(article.className).toBe(styles.content);
});

test("the `<article>` has the `entry` class of the entry's stylesheet alongside the shared content class", async () => {
  const article = await renderContent({ default: () => <p>Body</p>, stylesheetClassNames: { entry: "aboutEntry" } });
  expect(article.className.split(" ")).toEqual([styles.content, "aboutEntry"]);
});

test("the `<article>` contains only an element with the `data-content-body` attribute, which contains the entry's content", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });
  const body = article.querySelector("[data-content-body]");

  expect(article.children.length).toBe(1);
  expect(article.firstElementChild).toBe(body);
  expect(screen.getByText("Body").closest("[data-content-body]")).toBe(body);
});

test("the element with the `data-content-body` attribute begins with an `<h1>` of the entry's title, marked with the `data-feed-omit` attribute", async () => {
  const article = await renderContent({ default: () => <p>Body</p> });
  const heading = screen.getByRole("heading", { level: 1 });

  expect(heading.textContent).toBe(TITLE);
  expect(article.querySelector("[data-content-body]")?.firstElementChild).toBe(heading);
  expect(heading.hasAttribute("data-feed-omit")).toBe(true); // A feed reader renders the entry's title itself, so the body must not repeat it.
});

test("the `<h1>` has the `title` class of the entry's stylesheet", async () => {
  await renderContent({ default: () => <p>Body</p>, stylesheetClassNames: { title: "aboutTitle" } });
  expect(screen.getByRole("heading", { level: 1 }).className).toBe("aboutTitle");
});

test("every section heading is followed by a heading link to its own ID, named after the heading and outside any element with the `aria-hidden` attribute", async () => {
  await renderContent(headingAnchorFixture);

  for (const { tagName, title, id } of HEADINGS) {
    const heading = screen.getByRole("heading", { name: title });
    const link = screen.getByRole("link", { name: headingLinkName(title) });

    expect(link.getAttribute("href")).toBe(`#${id}`);
    expect(link.closest("[aria-hidden]")).toBeNull(); // An `aria-hidden` link is invalid the moment a click focuses it.
    expect(link.closest(tagName)).toBeNull(); // Inside the heading, the link would be read as part of it.
    expect(heading.nextElementSibling?.contains(link)).toBe(true);
  }
});

test("every heading is named by its text alone", async () => {
  await renderContent(headingAnchorFixture);
  expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    TITLE,
    ...HEADINGS.map(({ title }) => title),
  ]);
});

test.each([
  {
    description: "without the heading link the build appends",
    heading: (
      <EntrySectionHeading level={2} id="fixture-heading">
        Fixture Heading
      </EntrySectionHeading>
    ),
  },
  {
    description: "without the `id` attribute",
    heading: (
      <EntrySectionHeading level={2}>
        Fixture Heading
        <a href="#fixture-heading" data-heading-link="" />
      </EntrySectionHeading>
    ),
  },
])(
  "a section heading $description renders without a heading link, and is still programmatically focusable",
  async ({ heading }) => {
    await renderContent({ default: () => heading });

    const renderedHeading = screen.getByRole("heading", { name: "Fixture Heading" });

    expect(screen.queryByRole("link", { name: headingLinkName("Fixture Heading") })).toBeNull();
    expect(renderedHeading.getAttribute("tabindex")).toBe("-1");
  },
);

test.each(HEADINGS)(
  "opening an entry at a fragment scrolls to the `<$tagName>` it names and focuses it",
  async ({ title, id }) => {
    window.location.hash = `#${id}`;

    await renderContent(headingAnchorFixture);

    const heading = screen.getByRole("heading", { name: new RegExp(title) });

    expect(scrollIntoViewSilently).toHaveBeenCalledWith(heading, { block: "start" });
    expect(document.activeElement).toBe(heading);
  },
);

test("opening an entry at a fragment that does not name a heading does not scroll", async () => {
  window.location.hash = "#missing-heading";

  await renderContent(headingAnchorFixture);

  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("opening an entry without a fragment does not scroll", async () => {
  await renderContent(headingAnchorFixture);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("clicking a heading link copies the heading's canonical URL, shows a `Copied` tooltip, and plays a click sound", async () => {
  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: headingLinkName("Fixture Heading") });

  await act(async () => {
    fireEvent.click(link);
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith(canonicalUrl(`${ROUTE}#fixture-heading`));
  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("clicking a heading link does not scroll the heading into view", async () => {
  await renderContent(headingAnchorFixture);

  fireEvent.click(screen.getByRole("link", { name: headingLinkName("Fixture Heading") }));

  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("clicking a heading link with a modifier key follows the link rather than copying the heading's canonical URL", async () => {
  await renderContent(headingAnchorFixture);

  const isDefaultAllowed = fireEvent.click(screen.getByRole("link", { name: headingLinkName("Fixture Heading") }), {
    metaKey: true,
  });

  expect(isDefaultAllowed).toBe(true);
  expect(writeText).not.toHaveBeenCalled();
});

test("a failed copy from a heading link shows an alert that the link could not be copied instead of a `Copied` tooltip", async () => {
  writeText.mockRejectedValue(new Error("Denied"));

  await renderContent(headingAnchorFixture);

  const link = screen.getByRole("link", { name: headingLinkName("Fixture Heading") });

  await act(async () => {
    fireEvent.click(link);
    await Promise.resolve();
  });

  expect(screen.getByRole("alertdialog").textContent).toContain("The link couldn’t be copied."); // One alert shared by the article, not one per heading.
  expect(screen.queryByRole("tooltip")).toBeNull(); // The tooltip only displays the successful-copy confirmation.

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.getByRole("alertdialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

test("a copy from a heading link is announced by the entry's only status region, outside the `<article>`", async () => {
  const article = await renderContent(headingAnchorFixture);

  await act(async () => {
    fireEvent.click(screen.getByRole("link", { name: headingLinkName("Fixture Subheading") }));
    await Promise.resolve();
  });

  const statuses = screen.getAllByRole("status");

  expect(statuses).toHaveLength(1);
  expect(statuses[0]?.textContent).toBe("Copied");
  expect(article.contains(statuses[0]!)).toBe(false);
});

test("a copy from a code block is announced by the entry's only status region, outside the `<article>`", async () => {
  const article = await renderContent(codeBlocksFixture);
  const [firstCopyControl] = await screen.findAllByRole("button", { name: "Copy to clipboard" });

  await act(async () => {
    fireEvent.click(firstCopyControl!);
    await Promise.resolve();
  });

  const statuses = screen.getAllByRole("status");

  expect(statuses).toHaveLength(1);
  expect(statuses[0]?.textContent).toBe("Copied");
  expect(article.contains(statuses[0]!)).toBe(false);
});

test("a copy from a second code block during the first code block's confirmation is announced until the second's confirmation ends", async () => {
  await renderContent(codeBlocksFixture);
  vi.useFakeTimers();

  const [firstCopyControl, secondCopyControl] = screen.getAllByRole("button", { name: "Copy to clipboard" });
  const status = screen.getByRole("status");

  await copyFrom(firstCopyControl!);
  advanceTimersBy(STATE_DISPLAY_DURATION_MS / 2);
  await copyFrom(secondCopyControl!);
  advanceTimersBy(STATE_DISPLAY_DURATION_MS / 2);

  expect(status.textContent).toBe("Copied"); // The first copy's confirmation would have ended here.

  advanceTimersBy(STATE_DISPLAY_DURATION_MS / 2);

  expect(status.textContent).toBe("");
});

test("a second copy from the same code block during its confirmation inserts a new confirmation element into the status region", async () => {
  await renderContent(codeBlocksFixture);
  vi.useFakeTimers();

  const [copyControl] = screen.getAllByRole("button", { name: "Copy to clipboard" });
  const status = screen.getByRole("status");

  await copyFrom(copyControl!);

  const firstConfirmation = status.firstElementChild;

  advanceTimersBy(STATE_DISPLAY_DURATION_MS / 2);
  await copyFrom(copyControl!);

  expect(status.textContent).toBe("Copied");
  expect(status.firstElementChild).not.toBe(firstConfirmation); // A screen reader announces an inserted node, not an unchanged one.
});

test("removing a code block during its confirmation clears the confirmation from the status region", async () => {
  await renderContent({ default: RemovableCodeBlock });
  vi.useFakeTimers();

  const status = screen.getByRole("status");

  await copyFrom(screen.getByRole("button", { name: "Copy to clipboard" }));

  expect(status.textContent).toBe("Copied");

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  advanceTimersBy(STATE_DISPLAY_DURATION_MS);

  expect(status.textContent).toBe("");
});

test("a failed copy from a code block shows an alert that the code could not be copied", async () => {
  writeText.mockRejectedValue(new Error("Denied"));

  await renderContent(codeBlocksFixture);

  const [copyControl] = screen.getAllByRole("button", { name: "Copy to clipboard" });

  await copyFrom(copyControl!);

  expect(screen.getByRole("alertdialog").textContent).toContain("The code couldn’t be copied.");
});

test("a code block's clipboard write that succeeds after another code block's copy has started does not show a confirmation", async () => {
  await renderContent(codeBlocksFixture);

  const [firstCopyControl, secondCopyControl] = screen.getAllByRole("button", { name: "Copy to clipboard" });
  const status = screen.getByRole("status");
  const firstWrite = deferWrite(writeText);
  const secondWrite = deferWrite(writeText);

  await copyFrom(firstCopyControl!);
  await copyFrom(secondCopyControl!);
  await firstWrite.succeed();

  expect(status.textContent).toBe("");
  expect(screen.queryByRole("tooltip")).toBeNull();

  await secondWrite.fail();

  expect(status.textContent).toBe("");
  expect(screen.getByRole("alertdialog").textContent).toContain("The code couldn’t be copied.");
});

test("a code block's clipboard write that fails after another code block's copy has started does not show the failure alert", async () => {
  await renderContent(codeBlocksFixture);

  const [firstCopyControl, secondCopyControl] = screen.getAllByRole("button", { name: "Copy to clipboard" });
  const firstWrite = deferWrite(writeText);
  const secondWrite = deferWrite(writeText);

  await copyFrom(firstCopyControl!);
  await copyFrom(secondCopyControl!);
  await secondWrite.succeed();
  await firstWrite.fail();

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Copied");
  expect(screen.getByRole("tooltip").textContent).toBe("Copied");
});

test("a code block's clipboard write that succeeds after a heading link's copy has started does not show a confirmation", async () => {
  await renderContent({
    default: () => (
      <>
        <EntrySectionHeading level={2} id="fixture-heading">
          Fixture Heading
          <a href="#fixture-heading" data-heading-link="" />
        </EntrySectionHeading>
        <CodeBlock>
          <code>const first = 1;</code>
        </CodeBlock>
      </>
    ),
  });

  const firstWrite = deferWrite(writeText);
  const secondWrite = deferWrite(writeText);

  await copyFrom(screen.getByRole("button", { name: "Copy to clipboard" }));
  await copyFrom(screen.getByRole("link", { name: headingLinkName("Fixture Heading") }));
  await firstWrite.succeed();

  expect(screen.getByRole("status").textContent).toBe("");

  await secondWrite.succeed();

  expect(screen.getByRole("status").textContent).toBe("Copied");
  expect(writeText).toHaveBeenLastCalledWith(canonicalUrl(`${ROUTE}#fixture-heading`));
});

test.each(LINKS)("clicking the %s plays a click sound", async (name) => {
  await renderContent(linksFixture);

  fireEvent.click(screen.getByRole("link", { name }));

  expect(playClick).toHaveBeenCalledTimes(1);
});

test.each(LINKS)("clicking the %s with a modifier key does not play a click sound", async (name) => {
  await renderContent(linksFixture);

  fireEvent.click(screen.getByRole("link", { name }), { metaKey: true });

  expect(playClick).not.toHaveBeenCalled();
});

test("clicking a fragment link scrolls to the heading it names and focuses it, in place of the browser's navigation", async () => {
  await renderContent(linksFixture);

  const isDefaultAllowed = fireEvent.click(screen.getByRole("link", { name: "fragment link" }));
  const heading = screen.getByRole("heading", { name: "Fixture Heading" });

  expect(isDefaultAllowed).toBe(false);
  expect(scrollIntoViewSilently).toHaveBeenCalledWith(heading, { block: "start" });
  expect(document.activeElement).toBe(heading);
});

test("the external link has the `Opens in a new tab` description, and the internal, fragment, and email links do not", async () => {
  await renderContent(linksFixture);

  const descriptionOf = (name: string) => descriptionTextOf(screen.getByRole("link", { name }));

  expect(descriptionOf("external link")).toBe("Opens in a new tab");
  expect(descriptionOf("internal link")).toBeNull();
  expect(descriptionOf("fragment link")).toBeNull();
  expect(descriptionOf("email link")).toBeNull();
});

test("a callout renders its `label` prop as the callout label inside its `<aside>`", async () => {
  await renderContent(contentElementsFixture);
  const callout = screen.getByText("Fixture note.").closest("aside")!;

  expect(callout.className.split(" ")).toContain(calloutStyles.callout);
  expect(within(callout).getByText("Fixture callout label").className.split(" ")).toContain(calloutStyles.calloutLabel);
});

test("a callout with the `label` prop is named by its label", async () => {
  await renderContent(contentElementsFixture);
  expect(screen.getByRole("complementary", { name: "Fixture callout label" }).textContent).toContain("Fixture note.");
});

test("a callout whose `variant` prop is `warning` has the warning class alongside the callout class", async () => {
  await renderContent(contentElementsFixture);
  const warning = screen.getByText("Fixture warning.").closest("aside")!;

  expect(warning.className.split(" ")).toEqual([calloutStyles.callout, calloutStyles.calloutWarning]);
});

test("a callout without the `label` prop does not render a callout label or have an `aria-labelledby` attribute", async () => {
  await renderContent(contentElementsFixture);
  const callout = screen.getByText("Fixture callout without a label.").closest("aside")!;

  expect(callout.querySelector(`.${calloutStyles.calloutLabel}`)).toBeNull();
  expect(callout.hasAttribute("aria-labelledby")).toBe(false);
});

test("a rail aside is wrapped in a rail anchor that is a direct child of the element with the `data-content-body` attribute", async () => {
  const article = await renderContent(contentElementsFixture);
  const rail = screen.getByText(/Fixture rail note\./).closest("aside")!;

  expect(rail.className.split(" ")).toContain(styles.rail);
  expect(rail.parentElement?.className).toBe(styles.railAnchor);
  expect(rail.parentElement?.parentElement).toBe(article.querySelector("[data-content-body]"));
});

test("a rail aside renders its `label` prop as the rail label inside its `<aside>`", async () => {
  await renderContent(contentElementsFixture);
  const rail = screen.getByText(/Fixture rail note\./).closest("aside")!;

  expect(within(rail).getByText("Fixture rail label").className.split(" ")).toContain(styles.railLabel);
});

test("a rail aside with the `label` prop is named by its label", async () => {
  await renderContent(contentElementsFixture);
  expect(screen.getByRole("complementary", { name: "Fixture rail label" }).textContent).toContain("Fixture rail note.");
});

test("a rail aside without the `label` prop does not render a rail label or have an `aria-labelledby` attribute", async () => {
  await renderContent(contentElementsFixture);
  const rail = screen.getByText("Fixture rail note without a label.").closest("aside")!;

  expect(rail.querySelector(`.${styles.railLabel}`)).toBeNull();
  expect(rail.hasAttribute("aria-labelledby")).toBe(false);
});
