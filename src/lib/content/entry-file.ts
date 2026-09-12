// This module has no imports, so build plugins can use it.

export const MDX_EXTENSION = ".mdx";

declare const entryKeyBrand: unique symbol;

export type EntryKey = string & { readonly [entryKeyBrand]: "EntryKey" };

export const entryKey = (directoryName: string, slug: string) => `${directoryName}/${slug}` as EntryKey;
export const isEntryFile = (filePath: string) => filePath.endsWith(MDX_EXTENSION);
export const entrySlugOf = (filePath: string) => filePath.slice(0, -MDX_EXTENSION.length);
export const entryFileName = (slug: string) => `${slug}${MDX_EXTENSION}`;
export const stylesheetFilePathOf = (entryFilePath: string) => `${entrySlugOf(entryFilePath)}.module.css`;
