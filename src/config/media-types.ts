export const HTML_MEDIA_TYPE = "text/html";
export const PLAIN_TEXT_MEDIA_TYPE = "text/plain";
export const FEED_MEDIA_TYPE = "application/atom+xml";
export const MARKDOWN_MEDIA_TYPE = "text/markdown";

const servedAsUtf8 = (mediaType: string) => `${mediaType}; charset=utf-8`;

export const PLAIN_TEXT_CONTENT_TYPE = servedAsUtf8(PLAIN_TEXT_MEDIA_TYPE);
export const MARKDOWN_CONTENT_TYPE = servedAsUtf8(MARKDOWN_MEDIA_TYPE);
export const FEED_CONTENT_TYPE = servedAsUtf8(FEED_MEDIA_TYPE);
