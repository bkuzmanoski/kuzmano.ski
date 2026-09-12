import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { parseSrcset, stringifySrcset } from "srcset";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type { MediaKind } from "#/lib/content/media.ts";

import { elementNameOf, hasAttribute, isJsxElement } from "./tree.ts";

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

/** Returns definitions referenced by Markdown images, excluding link-only definitions. */
function imageDefinitionIdentifiersIn(tree: ContentNode): Set<string> {
  const identifiers = new Set<string>();

  visit(tree, (node) => {
    if (node.type === "imageReference" && node.identifier) {
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
  const imageDefinitions = imageDefinitionIdentifiersIn(tree);
  const mediaReferences: Array<MediaReference> = [];

  visit(tree, (node, _index, parent: ContentNode | undefined) => {
    const isMarkdownImage =
      node.type === "image" || (node.type === "definition" && imageDefinitions.has(node.identifier ?? ""));

    if (isMarkdownImage && typeof node.url === "string") {
      const replace = (url: string) => {
        node.url = url;
      };

      mediaReferences.push({
        node,
        attribute: null,
        reference: node.url,
        expected: "image",
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
