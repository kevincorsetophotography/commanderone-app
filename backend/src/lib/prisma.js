// Istanza Prisma condivisa: un solo client (un solo pool di connessioni) per
// tutto il processo, invece di una per file di rotta. Su Railway le connessioni
// al DB sono limitate, quindi conta.
const { PrismaClient } = require('@prisma/client');

const prisma = globalThis.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

module.exports = prisma;
