import { transliterateToMarathi } from './transliteration';

// Mock fetch globally; restore after all tests to avoid cross-suite pollution
const mockFetch = jest.fn();
const originalFetch = global.fetch;
beforeAll(() => { global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });

describe('transliterateToMarathi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty string for empty input', async () => {
    const result = await transliterateToMarathi('');
    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty string for whitespace-only input', async () => {
    const result = await transliterateToMarathi('   ');
    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns transliterated text on successful API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ['SUCCESS', [['Ravi', ['रवि']]]],
    });

    const result = await transliterateToMarathi('Ravi');
    expect(result).toBe('रवि');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('Ravi'),
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('returns empty string when API response is not SUCCESS', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ['FAILED', []],
    });

    const result = await transliterateToMarathi('Ravi');
    expect(result).toBe('');
  });

  it('returns empty string when API response has no candidates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ['SUCCESS', []],
    });

    const result = await transliterateToMarathi('Ravi');
    expect(result).toBe('');
  });

  it('returns empty string when fetch response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await transliterateToMarathi('Ravi');
    expect(result).toBe('');
  });

  it('returns empty string and does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await transliterateToMarathi('Ravi');
    expect(result).toBe('');
  });

  it('URL-encodes special characters in input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ['SUCCESS', [['Ram & Sita', ['राम & सीता']]]],
    });

    const result = await transliterateToMarathi('Ram & Sita');
    expect(result).toBe('राम & सीता');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('Ram & Sita')),
      expect.objectContaining({ signal: expect.anything() })
    );
  });
});
