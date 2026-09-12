import { SKIP, visit } from "unist-util-visit";

import type { ContentImage, ContentMedia } from "#/lib/content/media.ts";

import { mediaReferencesIn } from "./media-references.ts";
import { elementNameOf, hasAttribute, setMissingAttributes } from "./tree.ts";

import type { MediaReference } from "./media-references.ts";
import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

export type MediaForReference = (reference: string) => ContentMedia | null;
export type MediaForEntry = (absolutePath: string) => Promise<MediaForReference>;

export const NO_MEDIA_FOR_ENTRY: MediaForEntry = () => Promise.resolve(() => null);

interface RenderableReference {
  reference: MediaReference;
  media: ContentMedia;
}

/**
 * Returns renderable media references in document order.
 *
 * Unresolved or incompatible references remain unchanged. Trees without a path have no renderable references.
 */
async function renderableReferencesIn(
  tree: ContentParent,
  file: EntryVFile,
  mediaForEntry: MediaForEntry,
): Promise<Array<RenderableReference>> {
  if (!file.path) {
    return [];
  }

  const mediaForReference = await mediaForEntry(file.path);

  return mediaReferencesIn(tree).flatMap((reference): Array<RenderableReference> => {
    const media = mediaForReference(reference.reference);
    const isRenderable = media && (reference.expected === null || media.kind === reference.expected);

    return isRenderable ? [{ reference, media }] : [];
  });
}

// hast `img` nodes originate from Markdown; authored JSX remains `mdx-jsx`.
// Only Markdown images are sized and wrapped in `<picture>`.
const isMarkdownImageSource = ({ node, attribute }: MediaReference) =>
  node.type === "element" && node.tagName === "img" && attribute === "src";

const sourceElements = ({ alternates }: ContentImage): Array<ContentNode> =>
  alternates.map(({ srcSet, type }) => ({
    type: "element",
    tagName: "source",
    properties: { srcSet, type },
    children: [],
  }));

/** Rewrites media references in an entry's compiled markup. */
export function rehypeMedia(mediaForEntry: MediaForEntry) {
  return async function transform(tree: ContentParent, file: EntryVFile) {
    const markdownImages = new Map<ContentNode, ContentImage>();

    for (const { reference, media } of await renderableReferencesIn(tree, file, mediaForEntry)) {
      reference.replace(media.src);

      if (media.kind === "video" && reference.video) {
        const isSized = hasAttribute(reference.video, "width") || hasAttribute(reference.video, "height");

        setMissingAttributes(reference.video, {
          poster: media.posterImage.src,
          // Filled in together: an entry that writes one dimension is scaling the video, and the browser derives the other.
          ...(isSized ? {} : { width: media.width, height: media.height }),
        });
      } else if (media.kind === "image" && isMarkdownImageSource(reference)) {
        Object.assign(reference.node.properties!, {
          width: media.width,
          height: media.height,
          loading: "lazy",
          decoding: "async",
        });
        markdownImages.set(reference.node, media);
      }
    }

    visit(tree, (node, index, parent) => {
      // An authored `<picture>` already chooses its sources, and a `<picture>` cannot contain another.
      if (elementNameOf(node) === "picture") {
        return SKIP;
      }

      const image = markdownImages.get(node);

      if (!image || image.alternates.length === 0 || !parent || index === undefined) {
        return;
      }

      parent.children[index] = {
        type: "element",
        tagName: "picture",
        properties: {},
        children: [...sourceElements(image), node],
      };

      return SKIP; // Do not revisit the replacement subtree.
    });
  };
}

/** Rewrites media references in an entry's Markdown alternate to absolute URLs. */
export function remarkMedia(mediaForEntry: MediaForEntry, absolute: (path: string) => string) {
  return async function transform(tree: ContentParent, file: EntryVFile) {
    for (const { reference, media } of await renderableReferencesIn(tree, file, mediaForEntry)) {
      reference.replace(absolute(media.src));

      if (media.kind === "video" && reference.video) {
        // The alternate strips `<source>` elements and reads the file URL from `src`.
        setMissingAttributes(reference.video, { src: absolute(media.src), poster: absolute(media.posterImage.src) });
      }
    }
  };
}
