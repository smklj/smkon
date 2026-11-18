/**
 * Simple deterministic hash for content approval (djb2 variant).
 * Not cryptographic — only for exact-version matching in the approval UI.
 */
export function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  // Return positive hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function contentFingerprint(item: { title: string; body: string }): string {
  return simpleHash(`${item.title}\n${item.body}`);
}
