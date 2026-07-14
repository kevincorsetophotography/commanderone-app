// Seed di dati di TEST per l'ambiente di sviluppo locale.
// NON viene mai eseguito in produzione.
// Crea 2 gruppi demo indipendenti, per verificare a occhio l'isolamento multi-tenant.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { slugify, randomInviteCode } from '../src/lib/groupCodes.js'

const prisma = new PrismaClient()

const GROUP_A = {
  name: 'Demo Playgroup A',
  players: [
    { username: 'Ramuh',   commander: 'The Ur-Dragon',            colors: 'WUBRG', bracket: 3, avatar: 'Ugin, the Spirit Dragon' },
    { username: 'Shiva',   commander: "Atraxa, Praetors' Voice",  colors: 'WUBG',  bracket: 4, avatar: 'Jace, the Mind Sculptor' },
    { username: 'Ifrit',   commander: "Gishath, Sun's Avatar",    colors: 'RGW',   bracket: 2, avatar: 'Chandra, Torch of Defiance' },
    { username: 'Bahamut', commander: 'Yawgmoth, Thran Physician',colors: 'B',     bracket: 4, avatar: 'Liliana of the Veil' },
    { username: 'Leviath', commander: 'Lathril, Blade of the Elves', colors: 'BG', bracket: 2, avatar: 'Nissa, Who Shakes the World' },
    { username: 'Titan',   commander: 'Krenko, Mob Boss',         colors: 'R',     bracket: 1, avatar: 'Koth of the Hammer' },
  ],
}

const GROUP_B = {
  name: 'Demo Playgroup B',
  players: [
    { username: 'Nova',  commander: 'Muldrotha, the Gravetide', colors: 'BUG',  bracket: 3, avatar: 'Vraska, Relic Seeker' },
    { username: 'Astra', commander: 'Edgar Markov',             colors: 'RWB',  bracket: 3, avatar: 'Sorin, Grim Nemesis' },
    { username: 'Comet', commander: 'Meren of Clan Nel Toth',   colors: 'BG',   bracket: 2, avatar: 'Garruk Wildspeaker' },
    { username: 'Orion', commander: 'Prosper, Tome-Bound',      colors: 'BR',   bracket: 2, avatar: 'Chandra, Fire Artisan' },
  ],
}

const NOTES = [
  'Combo al turno 8, tavolo spazzato.',
  'Partita lunga, vinta ai punti vita.',
  'Wrath provvidenziale e poi alpha strike.',
  'Furto di mana e chiusura rapida.',
  null, null,
  'Politica fino all\'ultimo, poi colpo a sorpresa.',
]

const rint = (n) => Math.floor(Math.random() * n)
const pick = (a) => a[rint(a.length)]
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }

async function seedGroup(groupSpec, hash) {
  const slug = slugify(groupSpec.name)
  const inviteCode = randomInviteCode()
  const group = await prisma.group.create({ data: { name: groupSpec.name, slug, inviteCode } })

  const players = []
  for (const [i, p] of groupSpec.players.entries()) {
    const u = await prisma.user.create({ data: { username: p.username, password: hash, avatarCardName: p.avatar } })
    await prisma.groupMember.create({ data: { groupId: group.id, userId: u.id, role: i === 0 ? 'ADMIN' : 'PLAYER' } })
    const d = await prisma.deck.create({ data: { name: p.commander.split(',')[0], commander: p.commander, colors: p.colors, bracket: p.bracket, userId: u.id, groupId: group.id } })
    players.push({ user: u, deck: d })
  }

  const now = Date.now()
  const fiveMonths = 5 * 30 * 24 * 60 * 60 * 1000
  let made = 0

  // winner: elemento di `seated` che vince (null = random)
  const createGame = async (playedAt, seated, winner = null) => {
    let ordered
    if (winner) {
      const rest = shuffle(seated.filter(s => s !== winner))
      ordered = [winner, ...rest]
    } else {
      ordered = shuffle(seated)
    }
    const data = ordered.map((s, i) => {
      const placement = i + 1
      let eliminatedById = null
      if (placement > 1) {
        const better = ordered.slice(0, i)
        eliminatedById = pick(better).user.id
      }
      return { userId: s.user.id, deckId: s.deck.id, placement, isWinner: placement === 1, eliminatedById }
    })
    await prisma.game.create({
      data: { playedAt, notes: pick(NOTES), groupId: group.id, createdByUserId: seated[0].user.id, players: { create: data } },
    })
    made++
  }

  const gamesToMake = players.length >= 5 ? 28 : 14
  for (let g = 0; g < gamesToMake; g++) {
    const size = Math.min(players.length, pick([3, 4, 4, 4, 5]))
    const seated = shuffle(players).slice(0, size)
    if (seated.length < 3) continue
    const playedAt = new Date(now - Math.random() * fiveMonths)
    await createGame(playedAt, seated)
  }

  // Alcune partite recenti (ultimi giorni) → attivano Deck Spotlight e WeeklyActivity
  const daysAgo = (d) => new Date(now - d * 86400000)
  const recentSize = Math.min(players.length, 4)
  for (let d = 1; d <= 6; d++) {
    const seated = shuffle(players).slice(0, recentSize)
    if (seated.length < 3) continue
    await createGame(daysAgo(d), seated, players[0])
  }

  console.log(`  · ${group.name}: ${players.length} giocatori, ${made} partite. Invite code: ${inviteCode} (admin: ${groupSpec.players[0].username})`)
  return group
}

async function main() {
  console.log('Pulizia tabelle...')
  await prisma.gamePlayer.deleteMany({})
  await prisma.game.deleteMany({})
  await prisma.deck.deleteMany({})
  await prisma.groupMember.deleteMany({})
  await prisma.group.deleteMany({})
  await prisma.user.deleteMany({})

  const hash = await bcrypt.hash('test', 10)

  console.log('Seed di 2 gruppi demo...')
  await seedGroup(GROUP_A, hash)
  await seedGroup(GROUP_B, hash)

  console.log('\nSeed completato. Ogni utente ha password "test".')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
