const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} = require('node:fs');
const { dirname, join } = require('node:path');

function unique(items) {
  return Array.from(new Set(items));
}

function buildCandidatePairs() {
  const initCwd = process.env.INIT_CWD;
  const roots = unique(
    [
      join(__dirname, '..'),
      process.cwd(),
      initCwd,
      process.cwd() ? join(process.cwd(), 'apps', 'api') : undefined,
      initCwd ? join(initCwd, 'apps', 'api') : undefined,
    ].filter(Boolean),
  );

  return roots.map((root) => ({
    root,
    sourceDir: join(root, 'src', 'generated', 'prisma'),
    targetDir: join(root, 'dist', 'src', 'generated', 'prisma'),
  }));
}

function findAncestorWithFile(startDir, fileName) {
  let current = startDir;

  while (true) {
    const candidate = join(current, fileName);
    if (existsSync(candidate)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

const candidatePairs = buildCandidatePairs();
const resolvedPair = candidatePairs.find(({ sourceDir }) => existsSync(sourceDir));

if (!resolvedPair) {
  const existingTarget = candidatePairs.find(({ targetDir }) => existsSync(targetDir));
  if (existingTarget) {
    console.warn(
      `[copy-generated-prisma] source directory not found, but target already exists: ${existingTarget.targetDir}. Skipping copy.`,
    );
    process.exit(0);
  }

  throw new Error(
    `Prisma generated directory not found. Checked: ${candidatePairs
      .map(({ sourceDir }) => sourceDir)
      .join(', ')}`,
  );
}

const { sourceDir, targetDir } = resolvedPair;

function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync(source)) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

copyDirectory(sourceDir, targetDir);

if (process.env.VERCEL) {
  const repoRoot =
    findAncestorWithFile(__dirname, 'vercel.json') ??
    findAncestorWithFile(process.cwd(), 'vercel.json');

  if (repoRoot) {
    const mirroredSourceDir = join(repoRoot, 'src', 'generated', 'prisma');
    if (mirroredSourceDir !== sourceDir) {
      copyDirectory(sourceDir, mirroredSourceDir);
    }
  }
}
