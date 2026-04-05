// Usage:
//   npm run db:cloud:reset-migrate-seed
//   npm run db:local:reset-migrate-seed
//   node scripts/reset-migrate-seed.js --mode=cloud --migrate-only
//   node scripts/reset-migrate-seed.js --mode=local --no-seed

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const oracledb = require('oracledb');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

const args = process.argv.slice(2);
const migrateOnly = args.includes('--migrate-only');
const noSeed = args.includes('--no-seed');

function getArgValue(flagName) {
  const prefix = `${flagName}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const runtimeMode = (
  getArgValue('--mode') ||
  process.env.DB_CONNECTION_MODE ||
  'cloud'
)
  .toLowerCase()
  .trim();

const sqlDir = path.join(__dirname, '../sql');
const containerName = process.env.DB_CONTAINER_NAME || 'oracle-xe';

if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('Missing DB_USER or DB_PASSWORD in environment file');
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

function normalizeSqlStatements(fileContent) {
  const lines = fileContent.replace(/\r/g, '').split('\n');
  const statements = [];
  let plainSql = '';
  let blockLines = [];
  let inPlSqlBlock = false;

  const flushPlainSql = () => {
    let current = plainSql;
    let semicolonIndex = current.indexOf(';');

    const sanitizePlainStatement = (statementText) => {
      const cleaned = statementText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('--'))
        .join('\n')
        .trim();

      if (!cleaned || cleaned === '/') {
        return null;
      }

      return cleaned;
    };

    while (semicolonIndex >= 0) {
      const rawStatement = current.slice(0, semicolonIndex);
      const statement = sanitizePlainStatement(rawStatement);
      if (statement) {
        statements.push(statement);
      }
      current = current.slice(semicolonIndex + 1);
      semicolonIndex = current.indexOf(';');
    }
    plainSql = current;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inPlSqlBlock && /^(DECLARE|BEGIN)\b/i.test(trimmed)) {
      flushPlainSql();
      inPlSqlBlock = true;
      blockLines = [line];
      continue;
    }

    if (inPlSqlBlock) {
      if (trimmed === '/') {
        const block = blockLines.join('\n').trim();
        if (block) {
          statements.push(block);
        }
        blockLines = [];
        inPlSqlBlock = false;
      } else {
        blockLines.push(line);
      }
      continue;
    }

    plainSql += line + '\n';
  }

  if (inPlSqlBlock && blockLines.length > 0) {
    const trailingBlock = blockLines.join('\n').trim();
    if (trailingBlock) {
      statements.push(trailingBlock);
    }
  }

  flushPlainSql();

  const tail = plainSql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--'))
    .join('\n')
    .trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function getCloudConnectionOptions() {
  const walletPath = process.env.WALLET_PATH;
  const tnsName = process.env.TNS_NAME;
  const walletPassword = process.env.WALLET_PASSWORD;

  if (!walletPath || !tnsName || !walletPassword) {
    console.error(
      'Cloud mode requires WALLET_PATH, TNS_NAME, and WALLET_PASSWORD',
    );
    process.exit(1);
  }

  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: tnsName,
    configDir: walletPath,
    walletLocation: walletPath,
    walletPassword,
  };
}

function runDockerSql(relativeFiles) {
  const sqlLines = [
    'WHENEVER SQLERROR EXIT SQL.SQLCODE',
    ...relativeFiles.map((file) => `@/container-entrypoint-initdb.d/${file}`),
    'EXIT',
  ];

  const sqlScript = sqlLines.join('\n') + '\n';
  const sqlplusConn = `${process.env.DB_USER}/${process.env.DB_PASSWORD}@localhost:1521/${process.env.DB_SERVICE || 'XEPDB1'}`;
  const shCommand = `cat <<'SQL' | sqlplus -s ${sqlplusConn}\n${sqlScript}SQL`;

  console.log('==> Checking local Oracle container...');
  run('docker', ['inspect', containerName], 'Verify Oracle container exists');
  run(
    'docker',
    ['exec', '-i', containerName, 'sh', '-lc', shCommand],
    `Run local SQL files: ${relativeFiles.join(', ')}`,
  );
}

async function runCloudSql(relativeFiles) {
  console.log('==> Running SQL directly on Oracle Cloud...');
  const connection = await oracledb.getConnection(getCloudConnectionOptions());

  try {
    for (const relativeFile of relativeFiles) {
      const fullPath = path.join(sqlDir, relativeFile);
      const rawSql = fs.readFileSync(fullPath, 'utf8');
      const statements = normalizeSqlStatements(rawSql);

      console.log(
        `==> Executing ${relativeFile} (${statements.length} statements)...`,
      );

      for (const statement of statements) {
        await connection.execute(statement);
      }
    }

    await connection.commit();
  } finally {
    await connection.close();
  }
}

async function main() {
  const migrateFiles = [
    '04_migrate_user_profile.sql',
    '05_security_hardening.sql',
    '06_card_normalization.sql',
    '07_account_number_encryption.sql',
    '08_user_key_metadata.sql',
    '09_key_recovery_wrap.sql',
    '10_email_security_and_lock_policy.sql',
    '11_customer_phone_cccd_hash.sql',
    '12_fullname_encryption_compat.sql',
  ];
  const fullFiles = ['00_reset.sql', '01_schema.sql', ...migrateFiles];
  const sqlFiles = migrateOnly ? migrateFiles : fullFiles;

  if (runtimeMode === 'local') {
    console.log('==> Mode: local fallback (Docker Oracle)');
    runDockerSql(sqlFiles);
  } else {
    console.log('==> Mode: cloud-first (Oracle wallet)');
    await runCloudSql(sqlFiles);
  }

  if (!noSeed) {
    console.log('==> Seeding users/customers/accounts...');
    const seedArgs = [
      path.join(__dirname, 'seed-customers.js'),
      `--mode=${runtimeMode}`,
    ];
    run(process.execPath, seedArgs, 'Seed data');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
