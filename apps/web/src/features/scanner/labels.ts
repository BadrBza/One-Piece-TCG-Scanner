import type { CardRecognition } from './scanner.api';

export const languageLabels: Record<CardRecognition['language'], string> = {
  EN: 'Anglais',
  JP: 'Japonais',
  FR: 'Français',
  CN: 'Chinois',
  KR: 'Coréen',
  UNKNOWN: 'Non déterminée',
};

export const variantLabels: Record<CardRecognition['variant'], string> = {
  regular: 'Standard',
  parallel: 'Parallèle',
  alternate_art: 'Illustration alternative',
  manga: 'Manga',
  promo: 'Promotionnelle',
  unknown: 'À vérifier',
};
