/** Enlarges the lower part of the photograph without changing the original. */
export async function cardNumberCrop(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const cropHeight = Math.max(1, Math.round(image.naturalHeight * 0.4));
  const scale = Math.min(3, 1800 / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer le gros plan de la carte.');
  context.drawImage(image, 0, image.naturalHeight - cropHeight, image.naturalWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}
