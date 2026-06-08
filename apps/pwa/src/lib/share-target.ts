/**
 * Chrome share sheets may append the shared URL to the text payload while also
 * sending it as `url`. Search should use the human-selected text only. URL text
 * fragments decode into spaces, so the duplicate URL is removed as a whole
 * suffix instead of tokenized on whitespace.
 */
export function normalizeSharedSearchText(sharedText: string, sharedUrl: string): string {
  const trimmedText = sharedText.trim();
  const trimmedUrl = sharedUrl.trim();

  if (!trimmedUrl) {
    return trimmedText;
  }

  const textWithoutDuplicateUrl = trimmedText.endsWith(trimmedUrl)
    ? trimmedText.slice(0, -trimmedUrl.length).trim()
    : trimmedText;

  if (
    textWithoutDuplicateUrl.length >= 2 &&
    textWithoutDuplicateUrl.startsWith('"') &&
    textWithoutDuplicateUrl.endsWith('"')
  ) {
    return textWithoutDuplicateUrl.slice(1, -1).trim();
  }

  return textWithoutDuplicateUrl;
}

/**
 * Share-target query params are a delivery mechanism, not app state. Remove
 * them after importing the text so browser refreshes do not keep re-inserting
 * stale shared payloads into the search field.
 */
export function consumeSharedSearchParams(location: Location, history: History): string {
  const params = new URLSearchParams(location.search);
  if (!params.has('text')) {
    return '';
  }

  const sharedText = normalizeSharedSearchText(params.get('text') || '', params.get('url') || '');
  params.delete('title');
  params.delete('text');
  params.delete('url');

  const nextSearch = params.toString();
  history.replaceState(
    {},
    '',
    `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`
  );

  return sharedText;
}
