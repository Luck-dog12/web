const { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const sourceDir = join(__dirname, '..', 'src', 'generated', 'prisma');
const targetDir = join(__dirname, '..', 'dist', 'src', 'generated', 'prisma');

if (!existsSync(sourceDir)) {
  throw new Error(`Prisma generated directory not found: ${sourceDir}`);
}

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
