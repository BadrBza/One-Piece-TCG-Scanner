import { useEffect, useState } from 'react';

import { getPortfolio, removePortfolioCard, type PortfolioCard } from './portfolio.api';
import { errorMessage } from '../../lib/http';

export function usePortfolio() {
  const [cards, setCards] = useState<PortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function chargerCollection() {
    setLoading(true);
    setError(null);
    try {
      setCards(await getPortfolio());
    } catch (reason) {
      setError(errorMessage(reason, 'La collection est indisponible.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void chargerCollection(); }, []);

  async function retirerCarte(id: number) {
    await removePortfolioCard(id);
    setCards(current => current.filter(card => card.id !== id));
  }

  return { cards, loading, error, load: chargerCollection, remove: retirerCarte };
}
