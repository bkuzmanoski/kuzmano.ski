import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { parseSrcset, stringifySrcset } from "srcset";
import { unified } from "unified";
import { visitParents } from "unist-util-visit-parents";

import type { MediaKind } from "#/lib/content/media.ts";

import { elementNameOf, hasAttribute, hasSpreadAttribute, isJsxElement } from "./tree.ts";

import type { ContentNode } from "./tree.ts";

const URL_ATTRIBUTES = new Set(["src", "poster"]);
const URL_LIST_ATTRIBUTES = new Set(["srcSet", "srcset"]); // MDX keeps an authored attribute as written, so either spelling can appear.
const NON_FILE_REFERENCE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

const isRelativeReference = (reference: string) => reference.length > 0 && !NON_FILE_REFERENCE.test(reference);

export function mediaDirectoryFileNameOf(reference: string): string | null {
  const fileName = reference.replace(/^\.\//, "");
  return fileName.includes("/") ? null : fileName;
}

/** A relative media reference, the kind of media its markup can render, and how to rewrite it. */
export interface MediaReference {
  reference: string;
  expected: MediaKind | null; // `null` when the markup renders either kind, such as a component's `src`.
  canRenderAlternates: boolean; // Whether the markup can be wrapped in a `<picture>` that offers the image's alternates.
  node: ContentNode; // The Markdown image, definition, or element.
  attribute: string | null; // `null` for Markdown URLs.
  video: ContentNode | null; // The video playing this source, if any.
  replace: (url: string) => void; // Preserves other `srcset` candidates and descriptors.
}

interface StringAttribute {
  name: string;
  value: string;
  replaceValue: (replacement: string) => void;
}

/**
 * Whether a Markdown image, image reference, or `<img>` can be wrapped in a `<picture>` that offers its image's alternates.
 *
 * A `<picture>` cannot contain another. An `<img>` with a `srcset`, which a spread attribute can also set, chooses
 * among its own candidates, and a `<source>` would take precedence over them.
 */
function canRenderAlternates(node: ContentNode, ancestors: Array<ContentNode>): boolean {
  const isImage = node.type === "image" || node.type === "imageReference" || elementNameOf(node) === "img";
  const canSetSrcset = hasSpreadAttribute(node) || [...URL_LIST_ATTRIBUTES].some((name) => hasAttribute(node, name));

  return isImage && !canSetSrcset && !ancestors.some((ancestor) => elementNameOf(ancestor) === "picture");
}

/** Returns definitions used by image references that satisfy `isIncluded`, excluding link-only definitions. */
function imageDefinitionIdentifiersIn(
  tree: ContentNode,
  isIncluded: (imageReference: ContentNode, ancestors: Array<ContentNode>) => boolean = () => true,
): Set<string> {
  const identifiers = new Set<string>();

  visitParents(tree, (node: ContentNode, ancestors: Array<ContentNode>) => {
    if (node.type === "imageReference" && node.identifier && isIncluded(node, ancestors)) {
      identifiers.add(node.identifier);
    }
  });

  return identifiers;
}

/** Returns string attributes from JSX or compiled Markdown elements. */
function stringAttributesOf(node: ContentNode): Array<StringAttribute> {
  if (isJsxElement(node)) {
    return (node.attributes ?? []).flatMap((attribute): Array<StringAttribute> => {
      const { name, value } = attribute;

      if (!name || typeof value !== "string") {
        return []; // JSX expressions resolve at runtime.
      }

      const replaceValue = (replacement: string) => {
        attribute.value = replacement;
      };

      return [{ name, value, replaceValue }];
    });
  }

  const { properties } = node;

  if (node.type !== "element" || !properties) {
    return [];
  }

  return Object.entries(properties).flatMap(([name, value]): Array<StringAttribute> => {
    const replaceValue = (replacement: string) => {
      properties[name] = replacement;
    };

    return typeof value === "string" ? [{ name, value, replaceValue }] : [];
  });
}

function expectedKindOf(element: string | null, attribute: string, parentElement: string | null): MediaKind | null {
  if (attribute === "poster") {
    return "image";
  }

  if (element === "video" || (element === "source" && parentElement === "video")) {
    return "video";
  }

  return element === "img" ? "image" : null;
}

function videoPlaying(node: ContentNode, attribute: string, parent: ContentNode | undefined): ContentNode | null {
  if (attribute !== "src") {
    return null;
  }

  if (elementNameOf(node) === "video") {
    return node;
  }

  const isSourceOfVideo = elementNameOf(node) === "source" && elementNameOf(parent) === "video";

  return isSourceOfVideo && parent && !hasAttribute(parent, "src") ? parent : null;
}

/** Returns relative media references in document order for validation and rewriting. */
export function mediaReferencesIn(tree: ContentNode): Array<MediaReference> {
  const imageDefinitionIdentifiers = imageDefinitionIdentifiersIn(tree);
  const imageDefinitionIdentifiersThatCanRenderAlternates = imageDefinitionIdentifiersIn(tree, canRenderAlternates);
  const mediaReferences: Array<MediaReference> = [];

  visitParents(tree, (node: ContentNode, ancestors: Array<ContentNode>) => {
    const parent = ancestors.at(-1);
    const canImageRenderAlternates = canRenderAlternates(node, ancestors);
    const isImageDefinition = node.type === "definition" && imageDefinitionIdentifiers.has(node.identifier ?? "");

    if ((node.type === "image" || isImageDefinition) && typeof node.url === "string") {
      const replace = (url: string) => {
        node.url = url;
      };

      mediaReferences.push({
        node,
        attribute: null,
        reference: node.url,
        expected: "image",
        canRenderAlternates: isImageDefinition
          ? imageDefinitionIdentifiersThatCanRenderAlternates.has(node.identifier ?? "")
          : canImageRenderAlternates,
        video: null,
        replace,
      });
    }

    const element = elementNameOf(node);

    for (const { name, value, replaceValue } of stringAttributesOf(node)) {
      if (URL_ATTRIBUTES.has(name)) {
        mediaReferences.push({
          node,
          attribute: name,
          reference: value,
          expected: expectedKindOf(element, name, elementNameOf(parent)),
          canRenderAlternates: name === "src" && canImageRenderAlternates,
          video: videoPlaying(node, name, parent),
          replace: replaceValue,
        });
      } else if (URL_LIST_ATTRIBUTES.has(name)) {
        const candidates = parseSrcset(value);

        // `srcset` candidates are always images.
        mediaReferences.push(
          ...candidates.map((candidate, index): MediaReference => ({
            node,
            attribute: name,
            reference: candidate.url,
            expected: "image",
            canRenderAlternates: false,
            video: null,
            replace: (url) => {
              candidates[index] = { ...candidate, url };
              replaceValue(stringifySrcset(candidates));
            },
          })),
        );
      }
    }
  });

  return mediaReferences.filter(({ reference }) => isRelativeReference(reference));
}

const parser = unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx);

export const mediaReferencesInSource = (source: string) => mediaReferencesIn(parser.parse(source));
