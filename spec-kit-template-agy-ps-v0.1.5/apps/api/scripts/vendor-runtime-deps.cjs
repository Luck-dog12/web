const { execSync } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { join } = require('node:path');

function shouldVendorPackage(packageName) {
  if (packageName === 'prisma' || packageName === 'bcrypt') {
    return false;
  }

  if (packageName.startsWith('@types/')) {
    return false;
  }

  return true;
}

const apiRoot = join(__dirname, '..');
const apiPackageJson = JSON.parse(
  readFileSync(join(apiRoot, 'package.json'), 'utf8'),
);

const runtimeDependencies = Object.fromEntries(
  Object.entries(apiPackageJson.dependencies ?? {}).filter(([packageName]) =>
    shouldVendorPackage(packageName),
  ),
);

const tempInstallRoot = join(apiRoot, '.runtime-install');
const tempPackageJsonPath = join(tempInstallRoot, 'package.json');
const tempNodeModules = join(tempInstallRoot, 'node_modules');
const targetNodeModules = join(apiRoot, 'node_modules');
const tempNpmCache = join(tempInstallRoot, '.npm-cache');

rmSync(tempInstallRoot, { force: true, recursive: true });
mkdirSync(tempInstallRoot, { recursive: true });
mkdirSync(tempNpmCache, { recursive: true });

writeFileSync(
  tempPackageJsonPath,
  JSON.stringify(
    {
      private: true,
      dependencies: runtimeDependencies,
    },
    null,
    2,
  ),
);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

execSync(
  `${npmCommand} install --omit=dev --install-strategy=nested --no-package-lock`,
  {
    cwd: tempInstallRoot,
    env: {
      ...process.env,
      npm_config_cache: tempNpmCache,
      PRISMA_SKIP_POSTINSTALL_GENERATE: '1',
    },
    stdio: 'inherit',
  },
);

if (!existsSync(tempNodeModules)) {
  throw new Error('Runtime dependency installation did not create runtime node_modules');
}

rmSync(targetNodeModules, { force: true, recursive: true });

if (process.platform === 'win32') {
  const escapedSource = tempNodeModules.replace(/'/g, "''");
  const escapedTarget = targetNodeModules.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Copy-Item -Recurse -Force '${escapedSource}' '${escapedTarget}'"`,
    { stdio: 'inherit' },
  );
} else {
  renameSync(tempNodeModules, targetNodeModules);
}

rmSync(tempInstallRoot, { force: true, recursive: true });
