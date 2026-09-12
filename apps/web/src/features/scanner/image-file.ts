const MAX_FILE_SIZE = 7 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return 'Choisis une photo au format JPG, PNG ou WebP.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Cette photo est trop volumineuse. La taille maximale est de 7 Mo.';
  }
  return null;
}
export function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

