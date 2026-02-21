const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

async function ensureColumn(dbConn, table, column, alterSql) {
  const columns = await dbConn.all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    await dbConn.exec(alterSql);
  }
}

async function ensureCommentTypeAllowsBlocked(dbConn, tableName, scopeColumn, scopeTable) {
  const table = await dbConn.get(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );
  const createSql = String(table?.sql || "").toLowerCase();
  if (createSql.includes("bloqueado")) return;

  await dbConn.exec("PRAGMA foreign_keys = OFF;");
  try {
    await dbConn.exec("BEGIN TRANSACTION;");
    await dbConn.exec(`
      CREATE TABLE ${tableName}__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${scopeColumn} INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'anotacao',
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (${scopeColumn}) REFERENCES ${scopeTable}(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (type IN ('bug', 'melhoria', 'anotacao', 'bloqueado'))
      );
    `);
    await dbConn.exec(`
      INSERT INTO ${tableName}__new (id, ${scopeColumn}, user_id, type, content, created_at)
      SELECT id, ${scopeColumn}, user_id, type, content, created_at
      FROM ${tableName};
    `);
    await dbConn.exec(`DROP TABLE ${tableName};`);
    await dbConn.exec(`ALTER TABLE ${tableName}__new RENAME TO ${tableName};`);
    await dbConn.exec("COMMIT;");
  } catch (error) {
    await dbConn.exec("ROLLBACK;");
    throw error;
  } finally {
    await dbConn.exec("PRAGMA foreign_keys = ON;");
  }
}

async function initDb() {
  if (db) return db;

  db = await open({
    filename: path.resolve(__dirname, "..", "database.sqlite"),
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_to INTEGER,
      status TEXT NOT NULL DEFAULT 'a_fazer',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (status IN ('a_fazer', 'fazendo', 'concluido'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'anotacao',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (type IN ('bug', 'melhoria', 'anotacao', 'bloqueado'))
    );

    CREATE TABLE IF NOT EXISTS project_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'anotacao',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (type IN ('bug', 'melhoria', 'anotacao', 'bloqueado'))
    );
  `);

  await ensureColumn(
    db,
    "project_members",
    "role",
    "ALTER TABLE project_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'"
  );

  await ensureColumn(
    db,
    "comments",
    "type",
    "ALTER TABLE comments ADD COLUMN type TEXT NOT NULL DEFAULT 'anotacao'"
  );
  await ensureColumn(
    db,
    "project_comments",
    "type",
    "ALTER TABLE project_comments ADD COLUMN type TEXT NOT NULL DEFAULT 'anotacao'"
  );
  await ensureCommentTypeAllowsBlocked(db, "comments", "task_id", "tasks");
  await ensureCommentTypeAllowsBlocked(db, "project_comments", "project_id", "projects");

  await ensureColumn(
    db,
    "tasks",
    "finalized",
    "ALTER TABLE tasks ADD COLUMN finalized INTEGER NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "tasks",
    "finalized_at",
    "ALTER TABLE tasks ADD COLUMN finalized_at DATETIME"
  );

  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_nocase ON users(lower(name));`
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(lower(email));`
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_nocase ON projects(lower(name));`
  );

  return db;
}

module.exports = { initDb };
