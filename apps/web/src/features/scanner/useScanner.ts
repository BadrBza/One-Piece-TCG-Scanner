import { type ChangeEvent, useState } from 'react';

import { isNumberConfirmation, lookupCard, resolveCard, scanCard, type NumberConfirmationResult, type RecognizedScanResult } from './scanner.api';
import { errorMessage } from '../../lib/http';
import { cardNumberCrop, readFile, validateImageFile } from '../../lib/image-utils';

type ScanMode = 'photo' | 'manual';
type Operation = 'repos' | 'import' | 'scan' | 'recherche';

export function useScanner() {
  const [mode, setMode] = useState<ScanMode>('photo');
  const [cardNumber, setCardNumber] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizedScanResult | null>(null);
  const [confirmation, setConfirmation] = useState<NumberConfirmationResult | null>(null);
  const [resultSource, setResultSource] = useState<'photo' | 'manual'>('photo');
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>('repos');
  const busy = operation !== 'repos';

  function effacerResultat() {
    setError(null);
    setResult(null);
    setConfirmation(null);
  }

  function choisirMode(nextMode: ScanMode) {
    if (busy || nextMode === mode) return;
    setMode(nextMode);
    effacerResultat();
  }

  async function importerPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;

    effacerResultat();

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setOperation('import');
    try {
      setPreview(await readFile(file));
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de lire cette photo. Essaie avec une autre image.'));
    } finally {
      setOperation('repos');
    }
  }

  async function scannerCarte() {
    if (!preview || busy) return;

    setOperation('scan');
    effacerResultat();
    try {
      const grosPlan = await cardNumberCrop(preview);
      const scanResult = await scanCard(preview, grosPlan);
      setResultSource('photo');
      if (isNumberConfirmation(scanResult)) {
        setConfirmation(scanResult);
        return;
      }
      setResult(scanResult);
      setCardNumber(scanResult.card.cardNumber);
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de scanner cette carte pour le moment.'));
    } finally {
      setOperation('repos');
    }
  }

  async function confirmerNumero(number: string) {
    if (!confirmation || !preview || busy) return;
    setOperation('recherche');
    setError(null);
    try {
      const lookup = await resolveCard(number, preview);
      setResult(lookup);
      setCardNumber(number);
      setConfirmation(null);
      setResultSource('photo');
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de rechercher cette carte.'));
    } finally {
      setOperation('repos');
    }
  }

  async function chercherCarte() {
    if (!cardNumber.trim() || busy) return;

    setOperation('recherche');
    effacerResultat();
    try {
      const lookup = await lookupCard(cardNumber);
      setResult(lookup);
      setCardNumber(lookup.card.cardNumber);
      setResultSource('manual');
    } catch (reason) {
      setError(errorMessage(reason, 'Recherche impossible.'));
    } finally {
      setOperation('repos');
    }
  }

  return {
    mode, cardNumber, setCardNumber, preview, result, confirmation, resultSource,
    error, isImporting: operation === 'import', isScanning: operation === 'scan',
    isLookingUp: operation === 'recherche', busy, choisirMode, importerPhoto,
    scannerCarte, confirmerNumero, chercherCarte,
  };
}
