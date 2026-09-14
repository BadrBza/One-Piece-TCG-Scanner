export type DecodedImage = { data: Buffer; mediaType: string };

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Returns null when the data URL is missing, malformed, or empty after decode. */
export function parseDataUrl(value: string): DecodedImage | null {
  const match = IMAGE_PATTERN.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  const data = Buffer.from(match[2], 'base64');
  if (!data.length) return null;
  return { data, mediaType: match[1] };
}
