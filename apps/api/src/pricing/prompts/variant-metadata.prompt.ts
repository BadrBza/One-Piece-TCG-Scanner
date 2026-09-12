export const VARIANT_METADATA_PROMPT = `Classify each reference image separately.

Read the printed language from the image. Classify the illustration as:
- Manga: the background contains manga or comic panels, including colored or red panels;
- Affiche Wanted: WANTED or DEAD OR ALIVE dominates the artwork;
- Illustration alternative: another borderless or special full art;
- Standard: the ordinary card design;
- Promotionnelle: the image clearly shows a promotional treatment.

Manga and Affiche Wanted describe the artwork, not the rarity. Use "Non déterminée" when unsure. Return only the supplied reference IDs.`;
