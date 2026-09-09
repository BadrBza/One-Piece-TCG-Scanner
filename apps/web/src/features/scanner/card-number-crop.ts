/** Enlarges the lower part of the photograph without changing the original. */
export async function cardNumberCrop(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const sourceX = Math.round(image.naturalWidth * 0.4);
  const sourceY = Math.round(image.naturalHeight * 0.7);
  const cropWidth = Math.max(1, image.naturalWidth - sourceX);
  const cropHeight = Math.max(1, image.naturalHeight - sourceY);
  const scale = Math.max(1, Math.min(3, 1800 / cropWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer le gros plan de la carte.');
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}
