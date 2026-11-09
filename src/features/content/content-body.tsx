import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import { ImageGallery } from "#/features/image-gallery/image-gallery.tsx";
import { Video } from "#/features/video/video.tsx";
import { Waitlist } from "#/features/waitlist/waitlist.tsx";
import { cx } from "#/lib/class-names.ts";
import { RenderedEntryContext } from "#/lib/content/rendered-entry.ts";
import { contentIndexOf } from "#/site/windows.ts";
import type { EntryTarget } from "#/site/windows.ts";

import { Aside } from "./aside.tsx";
import { Callout } from "./callout.tsx";
import { CodeBlock } from "./code-block.tsx";
import styles from "./content-body.module.css";
import { ContentLink } from "./content-link.tsx";
import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";
import { EntryColophon } from "./entry-colophon.tsx";
import { EntryMasthead } from "./entry-masthead.tsx";
import { EntrySectionHeading } from "./entry-section-heading.tsx";
import { Footnote } from "./footnote.tsx";
import { ImageRow } from "./image-row.tsx";
import { observeRailClearances } from "./observe-rail-clearances.ts";
import { OpensInNewTabDescriptionProvider } from "./opens-in-new-tab-description-provider.tsx";
import { revealFragmentTarget } from "./reveal-fragment-target.ts";

import type { ContentComponentNameWith } from "./content-components.ts";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ComponentType } from "react";

const PROVIDED_COMPONENTS = {
  Aside,
  Callout,
  Footnote,
  ImageGallery,
  ImageRow,
  Waitlist,
} satisfies Record<ContentComponentNameWith<{ provided: "everywhere" }>, ComponentType<never>>;

/** The elements and components any entry can use without importing them. These load with every page. */
const MDX_COMPONENTS: MDXComponents = {
  h2: (props: ComponentProps<"h2">) => <EntrySectionHeading level={2} {...props} />,
  h3: (props: ComponentProps<"h3">) => <EntrySectionHeading level={3} {...props} />,
  a: ({ href, ...props }: ComponentProps<"a">) =>
    href === undefined ? <a {...props} /> : <ContentLink href={href} {...props} />,
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
  video: Video,
  ...PROVIDED_COMPONENTS,
};

/**
 * React calls the body's ref callback before this one, so the body sets the rail clearances, which move the elements
 * after them, before this callback scrolls to the fragment target.
 */
function revealInitialFragmentTarget(article: HTMLElement | null) {
  if (article) {
    revealFragmentTarget(article, window.location.hash);
  }
}

export function ContentBody({ route, target }: { route: string; target: EntryTarget }) {
  // Read the module with `use()` rather than the route loader, as loader data must be serializable. The content index
  // memoizes the promise `load` returns, so each render reads the same one.
  const { default: MDXContent, stylesheetClassNames } = use(contentIndexOf(target).load(target.slug));

  return (
    <RenderedEntryContext value={{ route }}>
      <OpensInNewTabDescriptionProvider>
        <EntryClipboardProvider>
          <MDXProvider components={MDX_COMPONENTS}>
            <article ref={revealInitialFragmentTarget} className={cx(styles.content, stylesheetClassNames.entry)}>
              <div ref={observeRailClearances} data-content-body>
                {target.collection !== null && <EntryMasthead target={target} />}
                <h1 className={stylesheetClassNames.title} data-feed-omit>
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
