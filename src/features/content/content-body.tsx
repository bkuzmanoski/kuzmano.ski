import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import { Waitlist } from "#/features/waitlist/waitlist.tsx";
import { cx } from "#/lib/class-names.ts";
import { RenderedEntryContext } from "#/lib/content/rendered-entry.ts";
import { revealFragmentTarget } from "#/lib/content/reveal-fragment-target.ts";
import type { MDXModule } from "#/site/catalog.ts";

import { Callout } from "./callout.tsx";
import { CodeBlock } from "./code-block.tsx";
import styles from "./content-body.module.css";
import { ContentLink, OpensInNewTabDescriptionProvider } from "./content-link.tsx";
import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";
import { EntrySectionHeading } from "./entry-section-heading.tsx";
import { ImageGrid } from "./image-grid.tsx";
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
  ImageGrid,
  Waitlist,
};

function revealInitialFragmentTarget(article: HTMLElement | null) {
  if (article) {
    revealFragmentTarget(article, window.location.hash);
  }
}

export function ContentBody({ route, title, content }: { route: string; title: string; content: Promise<MDXModule> }) {
  const { default: MDXContent, stylesheetClassNames } = use(content); // Read the module with `use()` rather than the route loader as loader data must be serializable.
  return (
    <RenderedEntryContext value={{ route }}>
      <OpensInNewTabDescriptionProvider>
        <EntryClipboardProvider>
          <MDXProvider components={MDX_COMPONENTS}>
            <article ref={revealInitialFragmentTarget} className={cx(styles.content, stylesheetClassNames?.entry)}>
              <div data-content-body>
                <h1 className={stylesheetClassNames?.title} data-feed-omit>
                  {title}
                </h1>
                <MDXContent />
              </div>
            </article>
          </MDXProvider>
        </EntryClipboardProvider>
      </OpensInNewTabDescriptionProvider>
    </RenderedEntryContext>
  );
}
