// Tetto giornaliero (globale, UTC) sulle domande al judge che usano Groq.
// Contatore persistito su DB (tabella JudgeLlmUsage) così sopravvive ai riavvii
// del processo — un contatore in memoria si azzererebbe ad ogni deploy/restart,
// vanificando il tetto proprio quando servirebbe di più.

const DEFAULT_CAP = 300;

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function dailyCap() {
  const n = Number(process.env.JUDGE_DAILY_LLM_CAP);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

// true se c'è ancora budget per una domanda che usa Groq oggi.
async function hasLlmBudget(prisma) {
  const usage = await prisma.judgeLlmUsage.findUnique({ where: { date: todayKey() } });
  return (usage?.count || 0) < dailyCap();
}

// Da chiamare SOLO dopo che una chiamata a Groq è andata a buon fine (mai prima
// del tentativo): contare prima significa che una GROQ_API_KEY assente/scaduta
// esaurirebbe il tetto giornaliero senza che Groq sia mai stato davvero usato,
// disattivando l'AI per il resto del giorno anche dopo aver sistemato la
// chiave. Il rovescio della medaglia è una piccola finestra di race tra
// richieste concorrenti vicino al tetto — accettabile per un limite di
// sicurezza sui costi, non una garanzia finanziaria hard.
async function recordLlmUsage(prisma) {
  const date = todayKey();
  await prisma.judgeLlmUsage.upsert({
    where: { date },
    create: { date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

module.exports = { todayKey, dailyCap, hasLlmBudget, recordLlmUsage };
