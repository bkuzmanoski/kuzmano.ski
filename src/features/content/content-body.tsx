import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import { Waitlist } from "#/features/waitlist/waitlist.tsx";
import { cx } from "#/lib/class-names.ts";
import { RenderedEntryContext } from "#/lib/content/rendered-entry.ts";
import { revealFragmentTarget } from "#/lib/content/reveal-fragment-target.ts";
import { contentIndexOf } from "#/site/windows.ts";
import type { EntryTarget } from "#/site/windows.ts";

import { Callout } from "./callout.tsx";
import { CodeBlock } from "./code-block.tsx";
import styles from "./content-body.module.css";
import { ContentLink, OpensInNewTabDescriptionProvider } from "./content-link.tsx";
import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";
import { EntryColophon } from "./entry-colophon.tsx";
import { EntryMasthead } from "./entry-masthead.tsx";
import { EntrySectionHeading } from "./entry-section-heading.tsx";
import { Footnote } from "./footnote.tsx";
import { ImageGrid } from "./image-grid.tsx";
import { observeRailClearances } from "./observe-rail-clearances.ts";
import { Rail } from "./rail.tsx";
import { Video } from "./video.tsx";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

// The elements and components any entry can use without importing them. These load with every page.
const MDX_COMPONENTS: MDXComponents = {
  h2: (props: ComponentProps<"h2">) => <EntrySectionHeading level={2} {...props} />,
  h3: (props: ComponentProps<"h3">) => <EntrySectionHeading level={3} {...props} />,
  a: ({ href, ...props }: ComponentProps<"a">) =>
    href === undefined ? <a {...props} /> : <ContentLink href={href} {...props} />,
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
  video: Video,
  Callout,
  Rail,
  Footnote, // Emitted by the build for each footnote definition (see `/build/content/markup/footnote-asides.ts`).
  ImageGrid,
  Waitlist,
};

// React calls the body's ref callback before this one, so the rail clearances, which
// move the elements after them, are set before the fragment target is scrolled to.
function revealInitialFragmentTarget(article: HTMLElement | null) {
  if (article) {
    revealFragmentTarget(article, window.location.hash);
  }
}

export function ContentBody({ route, target }: { route: string; target: EntryTarget }) {
  // Read the module with `use()` rather than the route loader, as loader data must be serializable.
  // The content index memoizes the promise `load` returns, so each render reads the same one.
  const { default: MDXContent, stylesheetClassNames } = use(contentIndexOf(target).load(target.slug));

  return (
    <RenderedEntryContext value={{ route }}>
      <OpensInNewTabDescriptionProvider>
        <EntryClipboardProvider>
          <MDXProvider components={MDX_COMPONENTS}>
            <article ref={revealInitialFragmentTarget} className={cx(styles.content, stylesheetClassNames?.entry)}>
              <div ref={observeRailClearances} data-content-body>
                {target.collection !== null && <EntryMasthead target={target} />}
                <h1 className={stylesheetClassNames?.title} data-feed-omit>
                  {target.title}
                </h1>
                <MDXContent />
                {target.collection !== null && <EntryColophon target={target} />}
              </div>
            </article>
          </MDXProvider>
        </EntryClipboardProvider>
      </OpensInNewTabDescriptionProvider>
    </RenderedEntryContext>
  );
}
