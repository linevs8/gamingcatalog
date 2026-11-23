/** GameDB indexes names like "9 Kings" in 9.json, not 9k.json. */
export function catalogBucket(normalizedTitle: string): string {
  const query = normalizedTitle.toLowerCase().trim();
  if (!query) return "";
  const first = query[0];
  const second = query[1] || "";
  if (!/[a-z0-9]/.test(first)) return "@";
  if (!/[a-z0-9]/.test(second)) return first;
  return first + second;
}
