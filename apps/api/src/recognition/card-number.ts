const CARD_NUMBER_PATTERN = /^(?:OP|ST|EB|PRB)\d{2}-\d{3}$|^P-\d{3}$/;

export function normalizeCardNumber(value: string) {
  return value.trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s/g, '');
}

export function isCardNumber(value: string) {
  return CARD_NUMBER_PATTERN.test(value);
}
