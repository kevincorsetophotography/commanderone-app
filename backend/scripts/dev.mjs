// Orchestratore di sviluppo locale.
// Avvia un PostgreSQL "embedded" isolato, sincronizza lo schema, semina dati di
// test se il DB è vuoto, poi lancia il backend con nodemon.
// La produzione (Railway) NON è coinvolta: usa il suo DATABASE_URL.
import 'dotenv/config'
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'fs'
import { execSync, spawn } from 'child_process'

const DB_DIR = './.devdb'
const PORT = 5433
const DB_NAME = 'commanderone_dev'

const pg = new EmbeddedPostgres({
  databaseDir: DB_DIR,
  user: 'dev',
  password: 'dev',
  port: PORT,
  persistent: true,
})

let child = null
let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\n👋 Spengo l\'ambiente locale...')
  try { child?.kill() } catch {}
  try { await pg.stop() } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  if (!existsSync(DB_DIR)) {
    console.log('🛠  Inizializzo il database locale (solo la prima volta)...')
    await pg.initialise()
  }
  console.log(`🐘 Avvio PostgreSQL locale su :${PORT}...`)
  await pg.start()

  // Garantisce un database UTF-8: su Windows initdb usa WIN1252 come default,
  // che non può memorizzare le emoji (commenti & reazioni). Se il DB manca o
  // non è UTF-8 lo (ri)creiamo da template0 con locale C.
  const admin = pg.getPgClient()
  await admin.connect()
  const { rows } = await admin.query(
    'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1',
    [DB_NAME]
  )
  const enc = rows[0]?.enc
  const createUtf8 = `CREATE DATABASE "${DB_NAME}" WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
  if (!enc) {
    await admin.query(createUtf8)
  } else if (enc !== 'UTF8') {
    console.log(`♻️  Database in ${enc}: lo ricreo in UTF-8...`)
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [DB_NAME])
    await admin.query(`DROP DATABASE "${DB_NAME}"`)
    await admin.query(createUtf8)
  }
  await admin.end()

  console.log('📦 Sincronizzo lo schema (prisma db push)...')
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const userCount = await prisma.user.count()
  await prisma.$disconnect()

  if (userCount === 0) {
    console.log('🌱 Database vuoto: eseguo il seed di test...')
    execSync('node prisma/seed.mjs', { stdio: 'inherit' })
  } else {
    console.log(`✅ Database locale pronto (${userCount} utenti).`)
  }

  console.log('🚀 Avvio il backend (nodemon)...\n')
  child = spawn('npx', ['nodemon', 'src/index.js'], { stdio: 'inherit', shell: true })
  child.on('exit', () => shutdown())
} catch (e) {
  console.error('❌ Errore avvio ambiente dev:', e?.message || e)
  await shutdown()
}
