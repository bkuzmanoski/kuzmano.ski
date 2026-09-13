import { SKIP, visit } from "unist-util-visit";

import type { ContentImage, ContentMedia } from "#/lib/content/media.ts";

import { mediaReferencesIn } from "./media-references.ts";
import { hasAttribute, setMissingAttributes } from "./tree.ts";

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
    const picturesByImageNode = new Map<ContentNode, ContentImage>();

    for (const { reference, media } of await renderableReferencesIn(tree, file, mediaForEntry)) {
      reference.replace(media.src);

      if (media.kind === "video" && reference.video) {
        const isSized = hasAttribute(reference.video, "width") || hasAttribute(reference.video, "height");
        setMissingAttributes(reference.video, {
          poster: media.posterImage.src,
          ...(isSized ? {} : { width: media.width, height: media.height }), // An entry that sets one dimension is scaling the video, and the browser derives the other.
        });
      } else if (media.kind === "image") {
        // A hast `img` node originates from Markdown, which cannot set an image's attributes, so the build
        // sets them. An authored `<img>` remains `mdx-jsx` and keeps only its authored attributes.

        if (isMarkdownImageSource(reference)) {
          Object.assign(reference.node.properties!, {
            width: media.width,
            height: media.height,
            loading: "lazy",
            decoding: "async",
          });
        }

        if (reference.canRenderAlternates) {
          picturesByImageNode.set(reference.node, media);
        }
      }
    }

    visit(tree, (node, index, parent) => {
      const picture = picturesByImageNode.get(node);

      if (!picture || picture.alternates.length === 0 || !parent || index === undefined) {
        return;
      }

      parent.children[index] = {
        type: "element",
        tagName: "picture",
        properties: {},
        children: [...sourceElements(picture), node], // The `<img>` keeps its attributes inside the `<picture>`.
      };

      return SKIP; // Do not revisit the replacement subtree.
    });
  };
}

/** Rewrites media references in an entry's Markdown representation to absolute URLs. */
export function remarkMedia(mediaForEntry: MediaForEntry, absolute: (path: string) => string) {
  return async function transform(tree: ContentParent, file: EntryVFile) {
    for (const { reference, media } of await renderableReferencesIn(tree, file, mediaForEntry)) {
      reference.replace(absolute(media.src));

      if (media.kind === "video" && reference.video) {
        setMissingAttributes(reference.video, { src: absolute(media.src), poster: absolute(media.posterImage.src) }); // The Markdown representation drops `<source>` elements and reads the file URL from `src`.
      }
    }
  };
}
