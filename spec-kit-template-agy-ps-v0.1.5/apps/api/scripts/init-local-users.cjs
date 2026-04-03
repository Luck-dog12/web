const fs = require('node:fs');
const path = require('node:path');
const { config: loadEnv } = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma');

function buildEnvCandidates(baseDir) {
  const candidates = [];
  let current = path.resolve(baseDir);

  while (true) {
    candidates.push(path.join(current, '.env'));
    candidates.push(path.join(current, 'apps/api/.env'));

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return candidates;
}

function loadClosestEnv() {
  const initCwd = process.env.INIT_CWD;
  const envCandidates = Array.from(
    new Set([
      ...(initCwd ? buildEnvCandidates(initCwd) : []),
      ...buildEnvCandidates(process.cwd()),
      ...buildEnvCandidates(__dirname),
    ]),
  );

  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) continue;
    loadEnv({ path: envPath });
    return envPath;
  }

  return null;
}

function normalizeEmail(input) {
  return input
    .normalize('NFKC')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

function parseArgs(argv) {
  const args = {};
  for (const entry of argv) {
    if (!entry.startsWith('--')) continue;
    const [rawKey, ...valueParts] = entry.slice(2).split('=');
    args[rawKey] = valueParts.length > 0 ? valueParts.join('=') : 'true';
  }
  return args;
}

function requirePassword(password, label) {
  if (password) return password;
  throw new Error(`Missing ${label}. Pass --password=... or --${label}=...`);
}

async function main() {
  const envPath = loadClosestEnv();
  const args = parseArgs(process.argv.slice(2));
  const sharedPassword = args.password;
  const adminPassword = args['admin-password'] ?? sharedPassword;
  const testPassword = args['test-password'] ?? sharedPassword;
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
  const localTestEmail = process.env.LOCAL_TEST_USER_EMAIL
    ? normalizeEmail(process.env.LOCAL_TEST_USER_EMAIL)
    : undefined;
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or DIRECT_URL is required');
  }

  const users = new Map();

  for (const email of adminEmails) {
    users.set(email, {
      email,
      password: requirePassword(adminPassword, 'admin-password'),
      isAdmin: true,
    });
  }

  if (localTestEmail) {
    users.set(localTestEmail, {
      email: localTestEmail,
      password: requirePassword(testPassword, 'test-password'),
      isAdmin: adminEmails.includes(localTestEmail),
    });
  }

  if (users.size === 0) {
    throw new Error(
      'No users configured. Set ADMIN_EMAILS and/or LOCAL_TEST_USER_EMAIL before running this script.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await prisma.$connect();

    for (const user of users.values()) {
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      const passwordHash = await bcrypt.hash(user.password, 10);

      await prisma.user.upsert({
        where: { email: user.email },
        update: { passwordHash },
        create: {
          email: user.email,
          passwordHash,
        },
      });

      console.log(
        `${existing ? 'updated' : 'created'} ${user.isAdmin ? 'admin' : 'user'} ${user.email}`,
      );
    }

    if (envPath) {
      console.log(`loaded env from ${envPath}`);
    }
    console.log(
      'admin access is resolved at runtime from ADMIN_EMAILS / ADMIN_USER_IDS; passwords stay out of .env',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    '[init-local-users] failed',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
