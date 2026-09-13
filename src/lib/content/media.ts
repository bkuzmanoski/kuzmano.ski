export type MediaKind = "image" | "video";

export interface Dimensions {
  width: number;
  height: number;
}

export interface PictureSource {
  srcSet: string;
  type: string; // Media type.
}

/** One media URL and its intrinsic dimensions. */
export interface SizedMedia extends Dimensions {
  src: string;
}

export interface ContentImage extends SizedMedia {
  kind: "image";
  alternates: Array<PictureSource>; // Offered ahead of the fallback at `src`, in preference order.
}

export interface ContentVideo extends SizedMedia {
  kind: "video";
  posterImage: SizedMedia;
}

export type ContentMedia = ContentImage | ContentVideo;

export interface CoverImage {
  social: SizedMedia; // Served as authored because social crawlers do not render AVIF.
  thumbnail: ContentImage;
}
