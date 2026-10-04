export const transliterateToMarathi = async (text: string): Promise<string> => {
  if (!text || !text.trim()) return '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text.trim())}&itc=mr-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return '';
    const data = await response.json();
    const result = data?.[1]?.[0]?.[1]?.[0];
    if (data[0] === 'SUCCESS' && typeof result === 'string') {
      return result;
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Transliteration failed:', error);
    }
  } finally {
    clearTimeout(timeoutId);
  }
  return '';
};
