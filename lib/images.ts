/**
 * Image URL helpers.
 *
 * Product images come from arbitrary merchant URLs (a `text` column), so only
 * local paths go through the Next.js image optimiser — remote hosts would need
 * an entry in `images.remotePatterns` first, and until they are listed the
 * optimiser answers with a 400 instead of the photo.
 */
export function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
