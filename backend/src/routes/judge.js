const router = require('express').Router();
const prisma = require('../lib/prisma');
const { askJudge } = require('../lib/judge');
const { rateLimit } = require('express-rate-limit');

const judgeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppe domande al judge, riprova tra qualche minuto.' },
});

// POST /api/groups/:slug/judge — domanda al judge bot
router.post('/', judgeLimiter, async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    return res.status(400).json({ error: 'Domanda troppo corta o mancante (minimo 5 caratteri)' });
  }

  const q = question.trim().slice(0, 500);

  try {
    const result = await askJudge(q);

    await prisma.judgeQuestion.create({
      data: {
        groupId:     req.group.id,
        userId:      req.user.id,
        question:    q,
        answer:      result.answer,
        explanation: result.explanation,
        confidence:  result.confidence,
        sourcesJson: JSON.stringify(result.sources),
        rulesUsed:   JSON.stringify(result.rulesUsed)
      }
    });

    res.json(result);
  } catch (err) {
    console.error('judge error:', err.message);
    if (err.message?.includes('GROQ_API_KEY')) {
      return res.status(503).json({ error: 'Servizio judge non configurato (GROQ_API_KEY mancante)' });
    }
    res.status(500).json({ error: 'Errore durante la consulenza. Riprova tra qualche istante.' });
  }
});

// GET /api/groups/:slug/judge — storico domande del gruppo (ultime 30, ordine cronologico inverso)
router.get('/', async (req, res) => {
  try {
    const questions = await prisma.judgeQuestion.findMany({
      where: { groupId: req.group.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, question: true, answer: true, confidence: true, createdAt: true,
        user: { select: { username: true, avatarCardName: true, avatarScryfallId: true } }
      }
    });
    res.json(questions);
  } catch (err) {
    console.error('judge history error:', err.message);
    res.status(500).json({ error: 'Errore nel caricamento dello storico' });
  }
});

module.exports = router;
