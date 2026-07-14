const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

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

// POST /api/auth/register — crea solo l'account. Il gruppo si crea/si raggiunge
// in un secondo momento (POST /api/groups oppure /api/groups/join).
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username e password richiesti' });
  if (typeof username !== 'string' || username.length > 32)
    return res.status(400).json({ error: 'Username troppo lungo (max 32 caratteri)' });
  if (typeof password !== 'string' || password.length > 128)
    return res.status(400).json({ error: 'Password troppo lunga (max 128 caratteri)' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, password: hash }
    });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username già esistente' });
    }
    console.error('register error', error);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenziali non valide' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
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
