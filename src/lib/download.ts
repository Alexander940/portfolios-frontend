/**
 * Browser download helpers.
 *
 * Endpoints that return a file are JWT-protected, so a plain `<a href>` can't
 * fetch them — the blob is downloaded through the axios client first and then
 * handed to the browser from memory. Extracted from the duplicated helpers in
 * the screener / portfolios export flows so new callers (the chat file cards)
 * share one implementation.
 */

/**
 * Trigger a browser download for an in-memory blob. The link is mounted to
 * `document.body` before the click for cross-browser compatibility, then
 * removed; the object URL is revoked on the next tick to give Safari time to
 * start the download.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Parse the filename out of a `Content-Disposition` header like
 * `attachment; filename="informe_2026-09-05.pdf"`. Returns `fallback` when the
 * header is missing or malformed (e.g. a cross-origin response where the
 * header isn't exposed to JS).
 */
export function extractFilename(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) return fallback;
  // RFC 5987 extended form first — it's the one that carries accents.
  const extended = /filename\*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(disposition);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      /* malformed percent-encoding — fall through to the plain forms */
    }
  }
  // RFC 6266 quoted-string form, then the unquoted token form.
  const quoted = /filename="([^"]+)"/i.exec(disposition);
  if (quoted) return quoted[1];
  const unquoted = /filename=([^;]+)/i.exec(disposition);
  if (unquoted) return unquoted[1].trim();
  return fallback;
}
