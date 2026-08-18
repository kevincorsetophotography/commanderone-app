const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { slugify, randomInviteCode } = require('../lib/groupCodes');

const MAX_NAME = 60;
const MAX_SLUG_ATTEMPTS = 20;
const MAX_CODE_ATTEMPTS = 10;

async function uniqueSlug(base) {
  let slug = base;
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const existing = await prisma.group.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${base}-${attempt + 1}`;
  }
  return null;
}

async function uniqueInviteCode() {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = randomInviteCode();
    const existing = await prisma.group.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  return null;
}

// POST /api/groups — crea un nuovo gruppo, il creatore ne diventa ADMIN
router.post('/', auth, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'GROUP_NAME_REQUIRED' });
  if (name.length > MAX_NAME) return res.status(400).json({ error: 'GROUP_NAME_TOO_LONG', max: MAX_NAME });

  try {
    const slug = await uniqueSlug(slugify(name));
    if (!slug) return res.status(500).json({ error: 'SLUG_GENERATION_FAILED' });

    const inviteCode = await uniqueInviteCode();
    if (!inviteCode) return res.status(500).json({ error: 'INVITE_CODE_GENERATION_FAILED' });

    const group = await prisma.group.create({
      data: {
        name, slug, inviteCode,
        members: { create: { userId: req.user.id, role: 'ADMIN' } },
      },
    });
    res.json({ id: group.id, name: group.name, slug: group.slug, inviteCode: group.inviteCode, role: 'ADMIN' });
  } catch (error) {
    console.error('create group error', error);
    res.status(500).json({ error: 'GROUP_CREATE_FAILED' });
  }
});

// POST /api/groups/join — unisciti a un gruppo esistente con un codice invito
router.post('/join', auth, async (req, res) => {
  const inviteCode = typeof req.body.inviteCode === 'string' ? req.body.inviteCode.trim() : '';
  if (!inviteCode) return res.status(400).json({ error: 'INVITE_CODE_REQUIRED' });

  try {
    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) return res.status(404).json({ error: 'INVITE_CODE_INVALID' });

    await prisma.groupMember.create({ data: { groupId: group.id, userId: req.user.id, role: 'PLAYER' } });
    res.json({ id: group.id, name: group.name, slug: group.slug, role: 'PLAYER' });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'ALREADY_GROUP_MEMBER' });
    }
    console.error('join group error', error);
    res.status(500).json({ error: 'GROUP_JOIN_FAILED' });
  }
});

// GET /api/groups/mine — gruppi di cui l'utente corrente fa parte
router.get('/mine', auth, async (req, res) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user.id },
      include: { group: { select: { id: true, name: true, slug: true, inviteCode: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(memberships.map(m => ({ ...m.group, role: m.role })));
  } catch (error) {
    console.error('list my groups error', error);
    res.status(500).json({ error: 'GROUPS_LOAD_FAILED' });
  }
});

// POST /api/groups/:slug/invite-code/regenerate — rigenera il codice (solo admin del gruppo)
router.post('/:slug/invite-code/regenerate', auth, async (req, res) => {
  try {
    const membership = await prisma.groupMember.findFirst({
      where: { userId: req.user.id, group: { slug: req.params.slug } },
    });
    if (!membership) return res.status(403).json({ error: 'NOT_GROUP_MEMBER' });
    if (membership.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_REQUIRED' });

    const inviteCode = await uniqueInviteCode();
    if (!inviteCode) return res.status(500).json({ error: 'INVITE_CODE_GENERATION_FAILED' });

    const group = await prisma.group.update({ where: { id: membership.groupId }, data: { inviteCode } });
    res.json({ inviteCode: group.inviteCode });
  } catch (error) {
    console.error('regenerate invite code error', error);
    res.status(500).json({ error: 'INVITE_CODE_REGENERATE_FAILED' });
  }
});

module.exports = router;
