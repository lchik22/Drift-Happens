export function* chunks<T>(items: readonly T[], size: number): Generator<T[]> {
  if (size <= 0) {
    throw new RangeError(`chunks: size must be > 0, got ${size}`);
  }
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}
