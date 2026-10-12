const MAX_DIMENSION = 400;
const JPEG_QUALITY = 0.8;

export class ImageCompressionError extends Error {
  constructor(public readonly reason: 'not-image' | 'unreadable') {
    super(reason);
    this.name = 'ImageCompressionError';
  }
}

/** Downscales a photo to fit within 400×400 and re-encodes it as JPEG so saves and share links stay small. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageCompressionError('not-image');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ImageCompressionError('unreadable'));
      element.src = objectUrl;
    });
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new ImageCompressionError('unreadable');
    const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new ImageCompressionError('unreadable');
    // JPEG has no transparency; paint white so transparent PNGs don't turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
