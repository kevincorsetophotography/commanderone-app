const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { validateUsername, validateEmail, validatePassword, normalizeEmail } = require('../lib/validators');
const { TYPES, issueToken, consumeToken } = require('../lib/authTokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../lib/mailer');

const VERIFY_TTL = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL = 60 * 60 * 1000;       // 1h

const signToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  avatarCardName: user.avatarCardName ?? null,
  avatarScryfallId: user.avatarScryfallId ?? null,
});

// Invia l'email di verifica senza far fallire la richiesta se il provider
// email è giù: l'utente può richiederla di nuovo da /resend-verification.
async function sendVerificationBestEffort(user) {
  if (!user.email) return;
  try {
    const raw = await issueToken(prisma, user.id, TYPES.VERIFY_EMAIL, VERIFY_TTL);
    await sendVerificationEmail(user.email, raw);
  } catch (e) {
    console.error('invio email verifica fallito', e);
  }
}

// POST /api/auth/register — crea solo l'account. Il gruppo si crea/si raggiunge
// in un secondo momento (POST /api/groups oppure /api/groups/join).
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const email = normalizeEmail(req.body.email);

  const invalid = validateUsername(username) || validateEmail(email) || validatePassword(password);
  if (invalid) return res.status(400).json({ error: invalid });

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, email, password: hash }
    });
    sendVerificationBestEffort(user);
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('email') ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} già in uso` });
    }
    console.error('register error', error);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// POST /api/auth/login — accetta username oppure email nel campo "username"
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Credenziali non valide' });

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: normalizeEmail(username) }] },
  });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenziali non valide' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me — profilo esteso dell'utente corrente (per la pagina Account)
router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, emailVerifiedAt: true, avatarCardName: true, avatarScryfallId: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json(user);
});

// POST /api/auth/verify-email — conferma l'indirizzo tramite il token del link
router.post('/verify-email', async (req, res) => {
  const token = await consumeToken(prisma, req.body.token, TYPES.VERIFY_EMAIL);
  if (!token) return res.status(400).json({ error: 'Link non valido o scaduto. Richiedi una nuova email di verifica.' });
  await prisma.user.update({
    where: { id: token.userId },
    data: { emailVerifiedAt: new Date() },
  });
  res.json({ ok: true });
});

// POST /api/auth/resend-verification — rimanda il link (autenticato)
router.post('/resend-verification', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.email) return res.status(400).json({ error: 'Nessuna email associata all\'account' });
  if (user.emailVerifiedAt) return res.status(400).json({ error: 'Email già verificata' });
  try {
    const raw = await issueToken(prisma, user.id, TYPES.VERIFY_EMAIL, VERIFY_TTL);
    await sendVerificationEmail(user.email, raw);
    res.json({ ok: true });
  } catch (e) {
    console.error('resend verification error', e);
    res.status(502).json({ error: 'Invio email fallito, riprova più tardi' });
  }
});

// POST /api/auth/forgot-password — risponde SEMPRE ok (niente user enumeration)
router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (validateEmail(email)) return res.status(400).json({ error: 'Email non valida' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    try {
      const raw = await issueToken(prisma, user.id, TYPES.RESET_PASSWORD, RESET_TTL);
      await sendPasswordResetEmail(user.email, raw);
    } catch (e) {
      console.error('invio email reset fallito', e);
    }
  }
  res.json({ ok: true });
});

// POST /api/auth/reset-password — imposta la nuova password tramite il token del link
router.post('/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  const invalid = validatePassword(newPassword);
  if (invalid) return res.status(400).json({ error: invalid });

  const token = await consumeToken(prisma, req.body.token, TYPES.RESET_PASSWORD);
  if (!token) return res.status(400).json({ error: 'Link non valido o scaduto. Richiedi un nuovo reset.' });

  const hash = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.update({
    where: { id: token.userId },
    data: {
      password: hash,
      passwordChangedAt: new Date(),
      // Il link è arrivato via email: la proprietà dell'indirizzo è dimostrata.
      emailVerifiedAt: token.user.emailVerifiedAt ?? new Date(),
    },
  });
  // Le vecchie sessioni sono invalidate da passwordChangedAt; ne apriamo una nuova.
  res.json({ ok: true, token: signToken(user), user: publicUser(user) });
});

// PATCH /api/auth/password — cambio password self-service (autenticato)
router.patch('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const invalid = validatePassword(newPassword);
  if (invalid) return res.status(400).json({ error: invalid });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password)))
    return res.status(401).json({ error: 'Password attuale errata' });

  const hash = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, passwordChangedAt: new Date() },
  });
  // Il token corrente muore con passwordChangedAt: ne restituiamo uno nuovo
  // così questa sessione resta attiva (le altre vengono disconnesse).
  res.json({ ok: true, token: signToken(updated) });
});

// PATCH /api/auth/profile — aggiorna avatar (autenticato)
router.patch('/profile', auth, async (req, res) => {
  const { avatarCardName, avatarScryfallId } = req.body;
  if (avatarScryfallId !== undefined && avatarScryfallId !== null) {
    if (typeof avatarScryfallId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(avatarScryfallId)) {
      return res.status(400).json({ error: 'avatarScryfallId non valido' });
    }
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        avatarCardName: avatarCardName ?? null,
        avatarScryfallId: avatarScryfallId ?? null,
      },
    });
    res.json({ ok: true, avatarCardName: updated.avatarCardName, avatarScryfallId: updated.avatarScryfallId });
  } catch (e) {
    console.error('update profile error', e);
    res.status(500).json({ error: 'Errore aggiornamento profilo' });
  }
});

module.exports = router;
