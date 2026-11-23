// Local PNG/JPG → WebP conversion in the browser (nothing leaves the computer until upload).
// Used automatically by every admin photo upload and by the "ממיר WebP" tool.
export const INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_INPUT = 20 * 1024 * 1024;

export async function toWebp(file, {maxSize = 1600, quality = 0.86} = {}) {
  if (!INPUT_TYPES.includes(file.type)) throw new Error('רק קבצי JPG, PNG או WebP');
  if (file.size > MAX_INPUT) throw new Error('הקובץ גדול מ־20MB');
  const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height); // PNG transparency is kept: WebP supports alpha
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('הדפדפן אינו תומך בהמרה ל־WebP');
    return {blob, width, height};
  } finally { bitmap.close?.(); }
}

// For uploads: convert JPG/PNG to WebP; keep the original if it is already WebP and small,
// or if conversion would make it bigger without resizing anything.
export async function prepareUpload(file, options) {
  if (file.type === 'image/webp' && file.size <= 5 * 1024 * 1024) return {blob: file, type: 'image/webp', ext: 'webp'};
  const {blob} = await toWebp(file, options);
  if (blob.size > 5 * 1024 * 1024) throw new Error('גם אחרי ההמרה התמונה גדולה מ־5MB');
  return {blob, type: 'image/webp', ext: 'webp'};
}

export const kb = bytes => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB';
