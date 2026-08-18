const express = require('express');
const router = express.Router();

// Proxy per immagini Scryfall: risolve il problema CORS su cards.scryfall.io (CDN senza CORS headers).
// Il client non può fetchare le immagini direttamente (redirect al CDN blocca il fetch), ma il server sì.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/art', async (req, res) => {
  const { name, id } = req.query;
  let url;
  if (id) {
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'INVALID_SCRYFALL_ID' });
    url = `https://api.scryfall.com/cards/${id}?format=image&version=art_crop`;
  } else if (name && typeof name === 'string' && name.length <= 200) {
    url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`;
  } else {
    return res.status(400).json({ error: 'SCRYFALL_NAME_OR_ID_REQUIRED' });
  }
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'CommanderOneTracker/1.0; contact=github.com/commanderone' },
    });
    if (!r.ok) return res.status(404).json({ error: 'CARD_NOT_FOUND' });
    const ct = r.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=604800'); // 7 giorni — le immagini Scryfall sono immutabili per ID
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[scryfall proxy]', e.message);
    res.status(502).json({ error: 'SCRYFALL_UNREACHABLE' });
  }
});

module.exports = router;
