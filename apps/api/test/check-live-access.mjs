import { fileURLToPath } from 'node:url';
process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
try {
  const response = await fetch('https://cardmarketapi.com/api/v1/usage', {
    headers: { 'X-API-Key': process.env.CARDMARKET_LIVE_API_KEY?.trim() ?? '' },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  console.log(JSON.stringify({ status: response.status, authenticated: response.ok }));
  if (!response.ok) process.exitCode = 1;
  if (response.ok && process.argv.includes('--search')) {
    const search = await fetch('https://cardmarketapi.com/api/v1/search?q=OP13-118&game=one-piece&limit=50', {
      headers: { 'X-API-Key': process.env.CARDMARKET_LIVE_API_KEY?.trim() ?? '' },
      redirect: 'error', signal: AbortSignal.timeout(25000),
    });
    const data = await search.json();
    console.log(JSON.stringify({ searchStatus: search.status, count: data.count, sample: data.results?.slice(0, 2) }));
    console.log(JSON.stringify({ incomplete: data.results?.filter(item => ['id','name','code','game','expansion','image_url'].some(key => typeof item[key] !== 'string' || !item[key])).map(item => ({ id: item.id, missing: ['id','name','code','game','expansion','image_url'].filter(key => typeof item[key] !== 'string' || !item[key]) })) }));
    const sample = data.results?.[0];
    if (sample && /^\d+$/.test(sample.id)) {
      const picture = await fetch(`https://cardmarketapi.com/cards/${sample.id}/image`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      console.log(JSON.stringify({ imageStatus: picture.status, contentType: picture.headers.get('content-type'), location: picture.headers.get('location') }));
      await picture.body?.cancel();
      if (process.argv.includes('--quote')) {
        const quote = await fetch(`https://cardmarketapi.com/api/v1/card/${sample.id}?language=japanese&condition=nm`, {
          headers: { 'X-API-Key': process.env.CARDMARKET_LIVE_API_KEY?.trim() ?? '' },
          redirect: 'error', signal: AbortSignal.timeout(60000),
        });
        const price = await quote.json();
        console.log(JSON.stringify({ quoteStatus: quote.status, id: price.id, game: price.game, currency: price.currency, filter: price.filter, prices: price.prices, fetched_at: price.fetched_at }));
      }
    }
    if (!search.ok) process.exitCode = 1;
  }
} catch {
  console.log(JSON.stringify({ networkError: true }));
  process.exitCode = 2;
}
