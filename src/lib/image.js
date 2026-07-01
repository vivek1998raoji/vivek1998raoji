// Turn an uploaded image File into a compact JPEG data URL so it can be
// stored without blowing the localStorage quota. Non-image files (PDFs) can't
// be downscaled, so we keep just their name as a placeholder until a real
// object store (Supabase Storage) is wired up.

export function fileToDownscaledDataUrl(file, maxDim = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type || !file.type.startsWith('image/')) {
      return resolve({ name: file.name, dataUrl: null, type: file.type || 'application/octet-stream' });
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve({
          name: file.name,
          dataUrl: canvas.toDataURL('image/jpeg', quality),
          type: 'image/jpeg',
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Convenience: resolve just the data URL (or null) for a single file input.
export async function fileToImageData(file) {
  const r = await fileToDownscaledDataUrl(file);
  return r || null;
}
