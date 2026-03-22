const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'it', 'is', 'was', 'i', 'my', 'me', 'we', 'our', 'that',
  'this', 'not', 'so', 'just', 'very', 'really', 'too', 'up', 'out', 'if',
  'be', 'do', 'did', 'had', 'has', 'have', 'been', 'were', 'are', 'am',
  'what', 'when', 'how', 'would', 'could', 'should', 'also', 'which',
  'there', 'their', 'they', 'you', 'your', 'him', 'her', 'his', 'its',
  'about', 'than', 'then', 'like', 'more', 'most', 'some', 'any', 'no',
]);

export function extractTopKeyword(texts: string[]): string | null {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOP_WORDS.has(w));
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  const entries = Object.entries(freq);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
