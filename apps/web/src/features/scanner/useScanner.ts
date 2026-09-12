import { type ChangeEvent, useState } from 'react';

import { isNumberConfirmation, lookupCard, resolveCard, scanCard, type NumberConfirmationResult, type RecognizedScanResult } from './scanner.api';
import { errorMessage } from '../../lib/http';
import { cardNumberCrop } from './card-number-crop';
import { readFile, validateImageFile } from './image-file';

type ScanMode = 'photo' | 'manual';

export function useScanner() {
  const [mode, setMode] = useState<ScanMode>('photo');
  const [cardNumber, setCardNumber] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizedScanResult | null>(null);
  const [confirmation, setConfirmation] = useState<NumberConfirmationResult | null>(null);
  const [resultSource, setResultSource] = useState<'photo' | 'manual'>('photo');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const busy = isImporting || isScanning || isLookingUp;

  function selectMode(nextMode: ScanMode) {
    if (busy || nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setResult(null);
    setConfirmation(null);
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setResult(null);
    setConfirmation(null);

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsImporting(true);
    try {
      setPreview(await readFile(file));
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de lire cette photo. Essaie avec une autre image.'));
    } finally {
      setIsImporting(false);
    }
  }

  async function recognizeCard() {
    if (!preview || busy) return;

    setIsScanning(true);
    setError(null);
    setResult(null);
    try {
      const scanResult = await scanCard(preview, await cardNumberCrop(preview));
      setResultSource('photo');
      if (isNumberConfirmation(scanResult)) {
        setConfirmation(scanResult);
      } else {
        setResult(scanResult);
        setCardNumber(scanResult.card.cardNumber);
      }
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de scanner cette carte pour le moment.'));
    } finally {
      setIsScanning(false);
    }
  }

  async function confirmCardNumber(number: string) {
    if (!confirmation || !preview || busy) return;
    setIsLookingUp(true);
    setError(null);
    try {
      const lookup = await resolveCard(number, preview);
      setResult({
        ...lookup,
        card: {
          ...lookup.card,
          language: confirmation.card.language,
          variant: confirmation.card.variant,
          confidence: confirmation.card.confidence,
        },
      });
      setCardNumber(number);
      setConfirmation(null);
      setResultSource('photo');
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de rechercher cette carte.'));
    } finally {
      setIsLookingUp(false);
    }
  }

  async function findCard() {
    if (!cardNumber.trim() || busy) return;

    setIsLookingUp(true);
    setError(null);
    setResult(null);
    setConfirmation(null);
    try {
      setResult(await lookupCard(cardNumber));
      setResultSource('manual');
    } catch (reason) {
      setError(errorMessage(reason, 'Recherche impossible.'));
    } finally {
      setIsLookingUp(false);
    }
  }

  return {
    mode, cardNumber, setCardNumber, preview, result, confirmation, resultSource,
    error, isImporting, isScanning, isLookingUp, busy, selectMode, importPhoto,
    recognizeCard, confirmCardNumber, findCard,
  };
}
