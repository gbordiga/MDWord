export type ImagePreviewLoader = (src: string) => Promise<string | null>;

let loader: ImagePreviewLoader | null = null;

/** Display-only. The document keeps the original relative path. */
export function setImagePreviewLoader(next: ImagePreviewLoader | null): void {
  loader = next;
}

export function imagePreviewLoader(): ImagePreviewLoader | null {
  return loader;
}

export function isEmbeddedOrRemoteImageSrc(src: string): boolean {
  return !src || src.startsWith("data:") || src.startsWith("blob:") || /^https?:/i.test(src);
}
