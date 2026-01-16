const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

/**
 * Migration Runner
 * Executes database migrations in order
 */

// Migration state table
const MIGRATIONS_TABLE = 'migrations';

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✓ Migrations table ready');
  } catch (error) {
    logger.error('Error creating migrations table:', error);
    throw error;
  }
}

/**
 * Get executed migrations
 */
async function getExecutedMigrations() {
  try {
    const [results] = await sequelize.query(`
      SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC
    `);
    return results.map(r => r.name);
  } catch (error) {
    logger.error('Error getting executed migrations:', error);
    throw error;
  }
}

/**
 * Get pending migrations
 */
async function getPendingMigrations() {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') && f !== 'run.js' && f !== 'status.js' && f !== 'rollback.js')
    .sort();

  const executed = await getExecutedMigrations();
  return files.filter(f => !executed.includes(f));
}

/**
 * Execute a single migration
 */
async function executeMigration(filename) {
  const migrationPath = path.join(__dirname, filename);
  const migration = require(migrationPath);

  logger.info(`Running migration: ${filename}`);

  try {
    await sequelize.transaction(async (transaction) => {
      // Execute up migration
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

      // Record migration
      await sequelize.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (:name)`,
        {
          replacements: { name: filename },
          transaction
        }
      );
    });

    logger.info(`✓ Migration completed: ${filename}`);
    return true;
  } catch (error) {
    logger.error(`✗ Migration failed: ${filename}`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    logger.info('========================================');
    logger.info('Starting database migrations...');
    logger.info('========================================');

    // Connect to database
    await sequelize.authenticate();
    logger.info('✓ Database connection established');

    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get pending migrations
    const pending = await getPendingMigrations();

    if (pending.length === 0) {
      logger.info('✓ No pending migrations');
      return;
    }

    logger.info(`Found ${pending.length} pending migration(s):`);
    pending.forEach(m => logger.info(`  - ${m}`));

    // Execute migrations
    for (const migration of pending) {
      await executeMigration(migration);
    }

    logger.info('========================================');
    logger.info('✓ All migrations completed successfully');
    logger.info('========================================');
  } catch (error) {
    logger.error('========================================');
    logger.error('✗ Migration failed');
    logger.error('========================================');
    logger.error(error);
    process.exit(1);
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
  executeMigration,
  getPendingMigrations,
  getExecutedMigrations
};
