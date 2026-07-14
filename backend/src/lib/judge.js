// Judge Bot — logica pura: Comprehensive Rules, Scryfall, Groq.
// CR URL: aggiornare ad ogni nuovo set da https://magic.wizards.com/en/rules
const CR_URL = 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260417.txt';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const SCRYFALL = 'https://api.scryfall.com';

let _crSections = []; // { id, text }[] — cache in memoria

// ── CR parsing & search (funzioni pure, testabili) ───────────────────────────

function parseComprehensiveRules(text) {
  const sections = [];
  // Lettered sub-rules (e.g. 608.2b) omit the trailing dot; make it optional.
  const pattern = /^(\d+(?:\.\d+[a-z]*)?)\.?\s+(.+)/;
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    const m = trimmed.match(pattern);
    // Require at least one dot in the id to avoid matching bare paragraph numbers
    if (m && m[1].includes('.')) sections.push({ id: m[1], text: trimmed });
  }
  return sections;
}

function searchInSections(sections, keywords, maxResults = 8) {
  if (!sections.length || !keywords.length) return [];
  const kws = keywords.map(k => k.toLowerCase());
  return sections
    .map(s => ({
      ...s,
      score: kws.reduce((n, kw) => n + (s.text.toLowerCase().includes(kw) ? 1 : 0), 0)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ id, text }) => ({ id, text }));
}

function extractKeywords(question) {
  const stopwords = new Set([
    'della', 'dello', 'degli', 'delle', 'nella', 'nello', 'negli', 'nelle',
    'posso', 'puoi', 'cosa', 'come', 'quando', 'dove', 'questo', 'questa',
    'questi', 'queste', 'viene', 'vengono', 'fare', 'fatto', 'alla', 'allo',
    'agli', 'alle', 'sono', 'siamo', 'avere', 'avuto', 'deve', 'devono',
    'carte', 'carta', 'gioco', 'giocatore', 'mano', 'campo', 'turno',
    'magia', 'magic', 'commander', 'mazzo', 'effetto', 'spell', 'that',
    'with', 'from', 'this', 'when', 'each', 'your', 'them', 'they'
  ]);
  return [...new Set(
    question.toLowerCase()
      .replace(/[^\wàèéìòù\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w))
  )];
}

// ── Caricamento CR all'avvio ─────────────────────────────────────────────────

async function loadComprehensiveRules() {
  try {
    const res = await fetch(CR_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    _crSections = parseComprehensiveRules(text);
    console.log(`✅ Comprehensive Rules caricate: ${_crSections.length} regole`);
  } catch (err) {
    console.warn(`⚠️  CR non caricate (${err.message}). Il judge userà solo Scryfall.`);
  }
}

// ── Scryfall ─────────────────────────────────────────────────────────────────

async function detectCardNames(question) {
  try {
    const res = await fetch(
      `${SCRYFALL}/cards/autocomplete?q=${encodeURIComponent(question)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.data) ? data.data.slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function fetchCardContext(cardName) {
  try {
    const res = await fetch(
      `${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const card = await res.json();
    const oracleText = card.oracle_text ||
      card.card_faces?.map(f => f.oracle_text).join(' // ') || '';

    let rulings = [];
    try {
      const rRes = await fetch(`${SCRYFALL}/cards/${card.id}/rulings`,
        { signal: AbortSignal.timeout(5000) });
      if (rRes.ok) {
        const rData = await rRes.json();
        rulings = (rData.data || []).slice(0, 5).map(r => r.comment);
      }
    } catch {}

    return { name: card.name, typeLine: card.type_line || '', oracleText, rulings };
  } catch {
    return null;
  }
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function groqChat({ model, messages, maxTokens = 1024, temperature = 0.1, _retry = 0 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY non configurata');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Groq HTTP ${res.status}`;

    // TPM / RPM rate limit: riprova dopo il delay suggerito (max 3 tentativi)
    if (res.status === 429 && _retry < 3) {
      const match = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
      const wait = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 10000 * (_retry + 1);
      await new Promise(r => setTimeout(r, wait));
      return groqChat({ model, messages, maxTokens, temperature, _retry: _retry + 1 });
    }

    throw new Error(msg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
}

// Mini-call veloce (llama 8B) per normalizzare nomi carta e concetti chiave.
// Risolve abbreviazioni (PoE, AoE, CoP...) e slang italiano (blinka, castare...).
async function normalizeQuestion(question) {
  try {
    const raw = await groqChat({
      model: 'llama-3.1-8b-instant',
      maxTokens: 300,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a Magic: The Gathering rules expert. Given a rules question (possibly in Italian or with abbreviations), extract:

1. "cardNames": exact English Magic card names. Resolve abbreviations and Italian names:
   PoE/path/percorso = "Path to Exile", StoP/swords/spade = "Swords to Plowshares",
   Sol Ring, CoP = "Circle of Protection", blinka/blink = look for card context,
   rimbalza/rimbalzo = bounce, palla di fuoco = "Fireball", etc.

2. "concepts": English CR search keywords for this specific interaction. Choose from:
   - Targeting: "target", "illegal target", "target becomes illegal", "counter on resolution", "608.2"
   - Zone change / blink / bounce: "new object", "zone change", "leaves battlefield", "400.7", "exile and return"
   - Stack: "stack", "respond", "response", "resolve"
   - Combat: "combat damage", "declare attackers", "declare blockers"
   - Replacement effects: "replacement effect", "instead"
   - Copy / token: "copy", "token", "create"
   Include "illegal target" and "new object" whenever the question involves targeting + zone change (blink/bounce/exile-return).

Respond only with valid JSON, no other text.`
        },
        {
          role: 'user',
          content: `Question: "${question}"\n\nRespond with: {"cardNames":["..."],"concepts":["..."]}`
        }
      ]
    });
    const parsed = JSON.parse(raw);
    return {
      cardNames: Array.isArray(parsed.cardNames) ? parsed.cardNames.slice(0, 4) : [],
      concepts:  Array.isArray(parsed.concepts)  ? parsed.concepts.slice(0, 8)  : []
    };
  } catch {
    return { cardNames: [], concepts: [] };
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function askJudge(question) {
  const questionKeywords = extractKeywords(question);

  // Step 1 — in parallelo: normalizza nomi/concetti (LLM veloce) + prima CR search
  const [normalized, initialCrMatches] = await Promise.all([
    normalizeQuestion(question),
    Promise.resolve(searchInSections(_crSections, questionKeywords, 5))
  ]);

  // Step 2 — fetcha oracle text + rulings per le carte rilevate
  const cardNamesToFetch = normalized.cardNames.length > 0
    ? normalized.cardNames
    : await detectCardNames(question); // fallback: autocomplete Scryfall

  const cardContexts = (
    await Promise.all(cardNamesToFetch.slice(0, 3).map(fetchCardContext))
  ).filter(Boolean);

  // Step 3 — arricchisci la ricerca CR con keyword inglesi da oracle text + concetti LLM
  const oracleKeywords = cardContexts.flatMap(c => extractKeywords(c.oracleText));
  const allKeywords = [...new Set([...questionKeywords, ...oracleKeywords, ...normalized.concepts])];
  const crMatches = searchInSections(_crSections, allKeywords, 10);

  // Unisci CR: quelli ricchi + quelli iniziali (che potrebbero non essere nell'unione)
  const crSeen = new Set(crMatches.map(r => r.id));
  const finalCr = [
    ...crMatches,
    ...initialCrMatches.filter(r => !crSeen.has(r.id))
  ].slice(0, 10);

  // Step 4 — costruisci il contesto per la risposta finale
  const cardSection = cardContexts.length > 0
    ? cardContexts.map(c =>
        `### ${c.name} (${c.typeLine})\n${c.oracleText}` +
        (c.rulings.length > 0
          ? '\nRuling ufficiali:\n' + c.rulings.map(r => `- ${r}`).join('\n')
          : '')
      ).join('\n\n')
    : '(nessuna carta rilevata nella domanda)';

  const crSection = finalCr.length > 0
    ? finalCr.map(r => `${r.id}: ${r.text}`).join('\n')
    : '(nessuna sezione CR trovata)';

  // Step 5 — risposta finale (LLM potente)
  const raw = await groqChat({
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1024,
    messages: [
      {
        role: 'system',
        content: `Sei un judge certificato Level 3 di Magic: The Gathering, specializzato in Commander/EDH.
Rispondi ESCLUSIVAMENTE in base ai testi forniti nel contesto (oracle text, ruling Scryfall, Comprehensive Rules).
Se il contesto non è sufficiente, indica confidence bassa e spiega cosa manca.
Non inventare numeri di regole: cita solo regole presenti nel contesto.
Rispondi sempre in italiano. Rispondi SOLO con JSON valido.

PRINCIPI FONDAMENTALI DI RAGIONAMENTO:

STACK (regola 405):
- Lo stack si risolve in ordine LIFO: l'ultimo spell/abilità aggiunto si risolve per PRIMO.
- "Gioco X in risposta a Y" significa che X è sopra Y nello stack → X si risolve PRIMA di Y.
- Un permanente entrato in gioco mentre uno spell è sullo stack È sul campo di battaglia quando quello spell risolve in seguito.
- Esempio: avversario gioca Wheel of Fortune, tu in risposta giochi Orcish Bowmasters → Bowmasters entra sul campo di battaglia PRIMA che Wheel risolva → le sue abilità triggered si attivano durante la risoluzione di Wheel.

ZONE CHANGE / BLINK / BOUNCE:
- "Blinkare" una creatura significa esiliarla dal campo di battaglia e farla tornare: sono DUE cambiamenti di zona.
- Ogni cambiamento di zona crea un NUOVO oggetto senza memoria del precedente (regola 400.7).
- Se il bersaglio di uno spell cambia zona dopo essere stato scelto come bersaglio, non è più lo stesso oggetto → il bersaglio è diventato illegale.
- Se TUTTI i bersagli di uno spell diventano illegali, lo spell viene contrastato in risoluzione (regola 608.2b). Non produce alcun effetto.
- Questo vale per QUALSIASI spell con un solo bersaglio: se il bersaglio viene blinkato/bounced/esiliato in risposta, lo spell non risolve.

UNDYING / PERSIST / COUNTER CONDITIONS:
- Undying: la creatura torna SOLO SE non aveva segnalini +1/+1 quando è morta. Con un +1/+1 sopra → NON torna.
- Persist: la creatura torna SOLO SE non aveva segnalini -1/-1 quando è morta. Con un -1/-1 sopra → NON torna.
- Questi sono replacement effect condizionali: la condizione va verificata al momento della morte, non al momento in cui si risolve.`
      },
      {
        role: 'user',
        content:
          `CARTE RILEVATE:\n${cardSection}\n\n` +
          `COMPREHENSIVE RULES PERTINENTI:\n${crSection}\n\n` +
          `DOMANDA: ${question}\n\n` +
          `Rispondi con esattamente questo JSON:\n` +
          `{"answer":"...","explanation":"...","confidence":0.0,"rulesUsed":["706.1"],"cardsDetected":["Nome"]}`
      }
    ]
  });

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Risposta non valida dal modello'); }

  return {
    answer:        String(parsed.answer || ''),
    explanation:   String(parsed.explanation || ''),
    confidence:    Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    rulesUsed:     Array.isArray(parsed.rulesUsed)     ? parsed.rulesUsed     : [],
    cardsDetected: Array.isArray(parsed.cardsDetected) ? parsed.cardsDetected : [],
    sources:       finalCr.map(r => ({ type: 'rule', id: r.id, text: r.text }))
  };
}

module.exports = {
  loadComprehensiveRules,
  parseComprehensiveRules,
  searchInSections,
  extractKeywords,
  askJudge
};
