// Has no imports because `/vite.config.ts` loads this module through `/build`.

/** Metadata used by the build and content tooling for components an entry can render. */
export interface ContentComponent {
  /**
   * `"everywhere"` for a component in `MDX_COMPONENTS` (see `content-body.tsx`), which any entry can render without
   * importing it, and `"by import"` for one an entry imports.
   */
  provided: "everywhere" | "by import";
  /**
   * `"inline"` for a component that renders inline content (e.g., a `<button>`), which an entry can place inside a
   * paragraph. The build fails for any other component inside one (see `/build/content/markup/inline-content.ts`).
   */
  renders: "inline" | "block";
  /**
   * Allowed child content for a block component that accepts only inline content (`"images"` restricts children to
   * images, enforced by `rehypeImageChildren`). The build unwraps paragraphs around Markdown children; inline
   * components implicitly allow only inline content.
   */
  childContent?: "inline" | "images";
  /**
   * `"subject"` for a component a rail aside can follow. It renders its `style` prop on its root element, where the
   * build sets the anchor name that the layout places the aside beside. `"aside"` for a rail aside. See
   * `/build/content/markup/rail-asides.ts`.
   */
  railRole?: "subject" | "aside";
  /** Props containing prose, checked for typographic quotes by `markdownlint.typographic-quotes.ts`. */
  proseAttributes?: ReadonlyArray<string>;
  /**
   * Markdown rendering strategy: `"fallback"` uses `COMPONENT_MARKDOWN` (see `/build/markdown/component-markdown.ts`),
   * `"children"` renders only its children, and `"none"` marks build-emitted components that entries cannot author.
   */
  markdown: "fallback" | "children" | "none";
}

/**
 * Every component in an entry, whether the entry renders it or the build emits it, keyed by name. The build fails for
 * an entry that renders a component this record does not list, and the typecheck fails when the components in
 * `MDX_COMPONENTS` (see `content-body.tsx`) or `COMPONENT_MARKDOWN` (see `/build/markdown/component-markdown.ts`)
 * differ from the ones it marks for them.
 */
export const CONTENT_COMPONENTS = {
  AboutHeader: { provided: "by import", renders: "block", proseAttributes: ["speech"], markdown: "children" },
  AlertButton: { provided: "by import", renders: "inline", proseAttributes: ["message"], markdown: "children" },
  Aside: { provided: "everywhere", renders: "block", railRole: "aside", markdown: "fallback" },
  Callout: { provided: "everywhere", renders: "block", railRole: "subject", markdown: "fallback" },
  CareerTimeline: { provided: "by import", renders: "block", markdown: "fallback" },
  ContributionGraph: { provided: "by import", renders: "block", markdown: "fallback" },
  // Emitted by the build for each footnote definition (see `/build/content/markup/footnote-asides.ts`).
  Footnote: { provided: "everywhere", renders: "block", railRole: "aside", markdown: "none" },
  ImageGallery: {
    provided: "everywhere",
    renders: "block",
    childContent: "images",
    railRole: "subject",
    proseAttributes: ["caption"],
    markdown: "fallback",
  },
  ImageRow: {
    provided: "everywhere",
    renders: "block",
    childContent: "inline",
    railRole: "subject",
    proseAttributes: ["caption"],
    markdown: "fallback",
  },
  PrintLink: { provided: "by import", renders: "inline", markdown: "fallback" },
  Waitlist: {
    provided: "everywhere",
    renders: "block",
    railRole: "subject",
    proseAttributes: ["action", "confirmation"], // `title` contains prose on any element (see `markdownlint.typographic-quotes.ts`).
    markdown: "fallback",
  },
} as const satisfies Record<string, ContentComponent>;

export type ContentComponentName = keyof typeof CONTENT_COMPONENTS;

/** Component names whose metadata matches `TFacts` (e.g., `{ markdown: "fallback" }`). */
export type ContentComponentNameWith<TFacts extends Partial<ContentComponent>> = {
  [TName in ContentComponentName]: (typeof CONTENT_COMPONENTS)[TName] extends TFacts ? TName : never;
}[ContentComponentName];

const CONTENT_COMPONENT_NAMES = Object.keys(CONTENT_COMPONENTS) as Array<ContentComponentName>;

/** Returns the facts of the component named `name`, or `undefined` when `CONTENT_COMPONENTS` does not list it. */
export const contentComponentOf = (name: string | null | undefined): ContentComponent | undefined =>
  name && Object.hasOwn(CONTENT_COMPONENTS, name) ? CONTENT_COMPONENTS[name as ContentComponentName] : undefined;

/** Returns the names of the components `isIncluded` accepts, in the order `CONTENT_COMPONENTS` lists them. */
export const contentComponentNamesWhere = (
  isIncluded: (component: ContentComponent) => boolean,
): Array<ContentComponentName> => CONTENT_COMPONENT_NAMES.filter((name) => isIncluded(CONTENT_COMPONENTS[name]));
