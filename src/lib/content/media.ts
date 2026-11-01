export type MediaKind = "image" | "video";

export interface Dimensions {
  width: number;
  height: number;
}

export interface PictureSource {
  srcSet: string;
  /** Media type. */
  type: string;
}

/** One media URL and its intrinsic dimensions. */
export interface SizedMedia extends Dimensions {
  src: string;
}

export interface ContentImage extends SizedMedia {
  kind: "image";
  /** Offered ahead of the fallback at `src`, in preference order. */
  alternates: Array<PictureSource>;
}

export interface ContentVideo extends SizedMedia {
  kind: "video";
  posterImage: SizedMedia;
}

export type ContentMedia = ContentImage | ContentVideo;

/** Served as authored because Open Graph crawlers do not render AVIF. */
export type CoverImage = SizedMedia;
