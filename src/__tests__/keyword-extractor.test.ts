import { describe, it, expect } from 'vitest';
import { extractTopKeyword } from '../main/keyword-extractor';

describe('extractTopKeyword', () => {
  it('returns the most frequent non-stop-word across multiple strings', () => {
    expect(extractTopKeyword(['meetings were exhausting', 'too many meetings today'])).toBe('meetings');
  });

  it('returns null when all words are stop words', () => {
    expect(extractTopKeyword(['the and or but'])).toBeNull();
  });

  it('returns null for empty input array', () => {
    expect(extractTopKeyword([])).toBeNull();
  });

  it('returns word with higher frequency when there is a clear winner', () => {
    expect(extractTopKeyword(['focus focus focus', 'distractions distractions'])).toBe('focus');
  });

  it('strips punctuation and lowercases before counting', () => {
    expect(extractTopKeyword(['Hello, world! Hello...'])).toBe('hello');
  });

  it('returns null when all words from extended stop-word list are present', () => {
    expect(extractTopKeyword(['I was just very really too not so'])).toBeNull();
  });

  it('returns word with highest frequency across multiple texts', () => {
    expect(extractTopKeyword(['email email phone', 'phone phone phone'])).toBe('phone');
  });
});
