let counter = 0;

/** Short unique id. Works in insecure contexts where crypto.randomUUID is unavailable. */
export function newId(): string {
  counter = (counter + 1) % 1679616;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + counter.toString(36);
}
