import { MDXProvider } from "@mdx-js/react";
import { useRouterState } from "@tanstack/react-router";
import { use, useEffect, useRef } from "react";

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

// Elements and components available to every entry without imports; loaded with every page.
const MDX_COMPONENTS: MDXComponents = {
  h2: (props: ComponentProps<"h2">) => <EntrySectionHeading level={2} {...props} />,
  h3: (props: ComponentProps<"h3">) => <EntrySectionHeading level={3} {...props} />,
  a: ({ href, ...props }: ComponentProps<"a">) =>
    href === undefined ? <a {...props} /> : <ContentLink href={href} {...props} />,
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
  video: Video,
  ...PROVIDED_COMPONENTS,
};

export function ContentBody({ route, target }: { route: string; target: EntryTarget }) {
  // Read the module with `use()` rather than the route loader, as loader data must be serializable. The content index
  // memoizes the promise `load` returns, so each render reads the same one.
  const { default: MDXContent, stylesheetClassNames } = use(contentIndexOf(target).load(target.slug));

  const routerLocation = useRouterState({
    select: ({ location }) => ({ pathname: location.pathname, hash: location.hash }),
  });
  const articleRef = useRef<HTMLElement | null>(null);
  const revealedInitialFragmentRef = useRef<string | null>(null);

  // React calls the body's ref callback first, setting rail clearances before scrolling to the fragment target so its
  // position reflects those layout shifts.
  function setArticleRef(article: HTMLElement | null) {
    articleRef.current = article;

    if (!article) {
      return;
    }

    const fragment = (routerLocation.pathname === route && routerLocation.hash) || window.location.hash;

    revealedInitialFragmentRef.current = routerLocation.pathname === route && routerLocation.hash ? fragment : null;

    if (fragment) {
      revealFragmentTarget(article, fragment);
    }
  }

  // Reveals a fragment target when navigation updates the URL to this entry while it stays mounted (e.g., following a
  // link to a fragment of an entry already open in another window, or using browser history).
  useEffect(() => {
    if (routerLocation.pathname !== route || !routerLocation.hash) {
      revealedInitialFragmentRef.current = null;
      return;
    }

    if (routerLocation.hash === revealedInitialFragmentRef.current) {
      revealedInitialFragmentRef.current = null;
      return;
    }

    if (articleRef.current) {
      revealFragmentTarget(articleRef.current, routerLocation.hash);
    }
  }, [route, routerLocation.pathname, routerLocation.hash]);

  return (
    <RenderedEntryContext value={{ route }}>
      <OpensInNewTabDescriptionProvider>
        <EntryClipboardProvider>
          <MDXProvider components={MDX_COMPONENTS}>
            <article ref={setArticleRef} className={cx(styles.content, stylesheetClassNames.entry)}>
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
