// Usage:
//   npm run db:reset-migrate-seed
//   npm run db:reset-migrate-seed -- --migrate-only
//   npm run db:reset-migrate-seed -- --no-seed

const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const migrateOnly = args.includes('--migrate-only');
const noSeed = args.includes('--no-seed');

const containerName = process.env.DB_CONTAINER_NAME || 'oracle-xe';
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbService = process.env.DB_SERVICE || 'XEPDB1';

if (!dbUser || !dbPassword) {
  console.error('Missing DB_USER or DB_PASSWORD in backend/.env');
  process.exit(1);
}

function run(command, commandArgs, label) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`\nERROR at step: ${label}`);
    process.exit(result.status || 1);
  }
}

function runDockerSql(sqlFiles) {
  const sqlLines = [
    'WHENEVER SQLERROR EXIT SQL.SQLCODE',
    ...sqlFiles.map((file) => `@${file}`),
    'EXIT',
  ];

  const sqlScript = sqlLines.join('\n') + '\n';
  const sqlplusConn = `${dbUser}/${dbPassword}@localhost:1521/${dbService}`;
  const shCommand = `cat <<'SQL' | sqlplus -s ${sqlplusConn}\n${sqlScript}SQL`;

  run(
    'docker',
    ['exec', '-i', containerName, 'sh', '-lc', shCommand],
    `Run SQL files: ${sqlFiles.join(', ')}`,
  );
}

console.log('==> Checking Oracle container...');
run('docker', ['inspect', containerName], 'Verify Oracle container exists');

if (migrateOnly) {
  console.log('==> Running migrate-only SQL...');
  runDockerSql([
    '/container-entrypoint-initdb.d/04_migrate_user_profile.sql',
    '/container-entrypoint-initdb.d/05_security_hardening.sql',
  ]);
} else {
  console.log('==> Reset DB and apply schema/migrations...');
  runDockerSql([
    '/container-entrypoint-initdb.d/00_reset.sql',
    '/container-entrypoint-initdb.d/01_schema.sql',
    '/container-entrypoint-initdb.d/04_migrate_user_profile.sql',
    '/container-entrypoint-initdb.d/05_security_hardening.sql',
  ]);
}

if (!noSeed) {
  console.log('==> Seeding users/customers/accounts...');
  run(
    process.execPath,
    [path.join(__dirname, 'seed-customers.js')],
    'Seed data',
  );
}

console.log('\nDone.');
