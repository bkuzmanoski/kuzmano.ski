# Generated media

This directory contains the image derivatives generated from content media:

- AVIF and WebP versions of images under `/content`
- Thumbnail-sized AVIF and WebP versions of cover images
- WebP versions of video poster images

The filenames encode the source content and encoding settings, so each name
identifies the inputs that produced that file. Do not edit, add, or delete files
in this directory manually.

To update the directory:

```bash
npm run prepare-media
```

The dev server generates missing derivatives when content is previewed and a
pre-commit hook runs `prepare-media` when content media is staged.
