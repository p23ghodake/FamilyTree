import { compressImage, ImageCompressionError } from './imageCompression';

describe('compressImage', () => {
  const originalImage = global.Image;
  let drawImage: jest.Mock;
  let toDataURL: jest.SpyInstance;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:photo');
    URL.revokeObjectURL = jest.fn();
    drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: jest.fn(), drawImage, fillStyle: '' } as unknown as CanvasRenderingContext2D);
    toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,small');
  });

  afterEach(() => {
    global.Image = originalImage;
    jest.restoreAllMocks();
  });

  function mockImage(width: number, height: number, fail = false) {
    global.Image = class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { setTimeout(() => (fail ? this.onerror?.() : this.onload?.())); }
    } as unknown as typeof Image;
  }

  it('downscales large photos to 400px and encodes them as JPEG', async () => {
    mockImage(2000, 1000);
    const result = await compressImage(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(result).toBe('data:image/jpeg;base64,small');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 200);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('keeps small photos at their original size', async () => {
    mockImage(120, 90);
    await compressImage(new File(['x'], 'small.jpg', { type: 'image/jpeg' }));
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 120, 90);
  });

  it('rejects non-image and unreadable files', async () => {
    await expect(compressImage(new File(['x'], 'notes.txt', { type: 'text/plain' }))).rejects.toMatchObject({ reason: 'not-image' });
    mockImage(0, 0, true);
    await expect(compressImage(new File(['x'], 'broken.png', { type: 'image/png' }))).rejects.toBeInstanceOf(ImageCompressionError);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
