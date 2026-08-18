const router = require('express').Router();
const prisma = require('../lib/prisma');
const { askJudge, lookupOnly } = require('../lib/judge');
const { hasLlmBudget, recordLlmUsage } = require('../lib/judgeBudget');
const { rateLimit } = require('express-rate-limit');

const judgeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'JUDGE_RATE_LIMITED' },
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /api/groups/:slug/judge — domanda al judge bot
router.post('/', judgeLimiter, async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    return res.status(400).json({ error: 'QUESTION_TOO_SHORT' });
  }

  const q = question.trim().slice(0, 500);

  // Tetto giornaliero globale sulle domande che usano Groq (vedi judgeBudget.js):
  // sopra il tetto, o se Groq stesso fallisce/non è configurato, si passa al
  // fallback gratuito invece di restituire un errore all'utente.
  let result, llmUsed;
  try {
    const budgetOk = await hasLlmBudget(prisma);
    if (budgetOk) {
      result = await askJudge(q);
      llmUsed = true;
      // Solo dopo un successo reale: se contassimo prima del tentativo, una
      // GROQ_API_KEY assente/scaduta brucerebbe il tetto giornaliero senza
      // aver mai davvero usato Groq, disattivando l'AI per il resto del
      // giorno anche dopo aver sistemato la chiave.
      await recordLlmUsage(prisma);
    } else {
      result = await lookupOnly(q);
      llmUsed = false;
    }
  } catch (err) {
    console.error('judge LLM error, fallback a lookupOnly:', err.message);
    llmUsed = false;
    try {
      result = await lookupOnly(q);
    } catch (fallbackErr) {
      console.error('judge fallback error:', fallbackErr.message);
      return res.status(500).json({ error: 'JUDGE_FALLBACK_FAILED' });
    }
  }

  try {
    await prisma.judgeQuestion.create({
      data: {
        groupId:     req.group.id,
        userId:      req.user.id,
        question:    q,
        answer:      result.answer,
        explanation: result.explanation,
        confidence:  result.confidence,
        sourcesJson: JSON.stringify(result.sources),
        rulesUsed:   JSON.stringify(result.rulesUsed),
        llmUsed
      }
    });
    res.json({ ...result, llmUsed });
  } catch (err) {
    console.error('judge save error:', err.message);
    res.status(500).json({ error: 'JUDGE_SAVE_FAILED' });
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
        id: true, question: true, answer: true, confidence: true, createdAt: true, llmUsed: true,
        user: { select: { username: true, avatarCardName: true, avatarScryfallId: true } }
      }
    });
    res.json(questions);
  } catch (err) {
    console.error('judge history error:', err.message);
    res.status(500).json({ error: 'JUDGE_HISTORY_LOAD_FAILED' });
  }
});

module.exports = router;
