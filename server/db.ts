import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Local SQLite database file stored in server directory
const dbPath = path.resolve(__dirname, 'cardio.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// 1. Initialize Tables
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  bank TEXT NOT NULL,
  card_name TEXT NOT NULL,
  network TEXT NOT NULL,
  annual_fee REAL DEFAULT 0,
  reward_type TEXT NOT NULL,
  reward_rate TEXT,
  travel_benefits TEXT,
  lounge_access TEXT,
  milestone_rewards TEXT
);

CREATE TABLE IF NOT EXISTS user_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT,
  custom_bank TEXT,
  custom_card_name TEXT,
  custom_network TEXT,
  last_four_digits TEXT,
  credit_limit REAL,
  billing_cycle_day INTEGER,
  payment_due_day INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_card_id TEXT,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  category_id TEXT,
  reward_earned REAL DEFAULT 0,
  cashback_earned REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_card_id) REFERENCES user_cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS airline_loyalty_programs (
  id TEXT PRIMARY KEY,
  airline TEXT NOT NULL,
  program_name TEXT NOT NULL,
  points_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  departure TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date TEXT,
  return_date TEXT,
  estimated_cash_fare REAL,
  program_id TEXT,
  target_points REAL NOT NULL,
  cabin TEXT DEFAULT 'ECONOMY',
  trip_type TEXT DEFAULT 'ONE_WAY',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS brand_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_card_id TEXT,
  brand_name TEXT NOT NULL,
  campaign_name TEXT,
  status TEXT DEFAULT 'PENDING',
  portal_url TEXT,
  multiplier_benefit TEXT,
  valid_until TEXT,
  notes TEXT,
  identifier_type TEXT DEFAULT 'EMAIL',
  masked_identifier TEXT,
  registration_date TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_card_id) REFERENCES user_cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS offer_redemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  transaction_id TEXT,
  user_card_id TEXT,
  card_id TEXT,
  merchant_name TEXT NOT NULL,
  transaction_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'SAVED',
  estimated_discount REAL DEFAULT 0,
  confirmed_discount REAL DEFAULT 0,
  estimated_cashback REAL DEFAULT 0,
  confirmed_cashback REAL DEFAULT 0,
  estimated_reward_points REAL DEFAULT 0,
  confirmed_reward_points REAL DEFAULT 0,
  cashback_status TEXT DEFAULT 'NOT_APPLICABLE',
  redemption_date TEXT DEFAULT (date('now')),
  confirmation_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_card_id) REFERENCES user_cards(id) ON DELETE SET NULL
);
`);

// 2. Seed Default Accounts Requested by User
const DEFAULT_USERS = [
  { id: 'u-harshghole', username: 'harshghole', fullName: 'Harsh Ghole', email: 'harshghole@cardio.local' },
  { id: 'u-sanviambekar', username: 'sanviambekar', fullName: 'Sanvi Ambekar', email: 'sanviambekar@cardio.local' },
  { id: 'u-arjunirdande', username: 'arjunirdande', fullName: 'Arjun Irdande', email: 'arjunirdande@cardio.local' },
  { id: 'u-drpramodbide', username: 'drpramodbide', fullName: 'Dr. Pramod Bide', email: 'drpramodbide@cardio.local' },
  { id: 'u-sample', username: 'sample', fullName: 'Sample User', email: 'sample@cardio.local' },
];

const DEFAULT_PASSWORD = 'Password@123';

const insertUserStmt = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, password, full_name, email)
  VALUES (?, ?, ?, ?, ?)
`);

const insertProfileStmt = db.prepare(`
  INSERT OR IGNORE INTO profiles (id, full_name, username)
  VALUES (?, ?, ?)
`);

for (const u of DEFAULT_USERS) {
  insertUserStmt.run(u.id, u.username, DEFAULT_PASSWORD, u.fullName, u.email);
  insertProfileStmt.run(u.id, u.fullName, u.username);
}

// 3. Query Builder for Drop-in Supabase Compatibility
class QueryBuilder {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private conditions: { col: string; op: string; val: any }[] = [];
  private orderClauses: { col: string; dir: 'ASC' | 'DESC' }[] = [];
  private limitCount?: number;
  private selectCols: string = '*';
  private insertPayload?: any;
  private updatePayload?: any;
  private exactCount: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*', options?: { count?: string; head?: boolean }) {
    this.selectCols = columns;
    if (options?.count === 'exact') this.exactCount = true;
    return this;
  }

  insert(payload: any | any[]) {
    this.action = 'insert';
    this.insertPayload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: any) {
    this.action = 'update';
    this.updatePayload = payload;
    return this;
  }

  delete(options?: { count?: string }) {
    this.action = 'delete';
    if (options?.count === 'exact') this.exactCount = true;
    return this;
  }

  eq(col: string, val: any) {
    const normalizedVal = typeof val === 'boolean' ? (val ? 1 : 0) : val;
    this.conditions.push({ col, op: '=', val: normalizedVal });
    return this;
  }

  gte(col: string, val: any) {
    this.conditions.push({ col, op: '>=', val });
    return this;
  }

  lte(col: string, val: any) {
    this.conditions.push({ col, op: '<=', val });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderClauses.push({ col, dir: options?.ascending === false ? 'DESC' : 'ASC' });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  private buildWhere(): { sql: string; params: any[] } {
    if (this.conditions.length === 0) return { sql: '', params: [] };
    const clauses = this.conditions.map(c => `"${c.col}" ${c.op} ?`);
    const params = this.conditions.map(c => c.val);
    return { sql: ` WHERE ${clauses.join(' AND ')}`, params };
  }

  async single(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const item = Array.isArray(res.data) ? res.data[0] || null : res.data;
    if (!item) return { data: null, error: { message: 'Row not found' } };
    return { data: item, error: null };
  }

  async maybeSingle(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const item = Array.isArray(res.data) ? res.data[0] || null : res.data;
    return { data: item, error: null };
  }

  // Thenable to allow `await query`
  then(resolve: (value: any) => void, reject?: (reason: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      if (this.action === 'insert') {
        const rows = this.insertPayload;
        const insertedResults: any[] = [];
        for (const item of rows) {
          const rowData = { ...item };
          if (!rowData.id) {
            rowData.id = crypto.randomUUID();
          }
          if (rowData.is_active !== undefined) {
            rowData.is_active = rowData.is_active ? 1 : 0;
          }
          const keys = Object.keys(rowData);
          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(rowData);

          const stmt = db.prepare(`INSERT INTO "${this.tableName}" (${cols}) VALUES (${placeholders})`);
          stmt.run(...values);

          // Retrieve inserted row
          const getStmt = db.prepare(`SELECT * FROM "${this.tableName}" WHERE id = ?`);
          const inserted = getStmt.get(rowData.id);
          insertedResults.push(inserted);
        }
        return { data: rows.length === 1 ? insertedResults[0] : insertedResults, error: null };
      }

      if (this.action === 'update') {
        const { sql: whereSql, params: whereParams } = this.buildWhere();
        const setClauses: string[] = [];
        const setParams: any[] = [];

        for (const [key, val] of Object.entries(this.updatePayload)) {
          setClauses.push(`"${key}" = ?`);
          setParams.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
        }

        if (setClauses.length > 0) {
          const updateSql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')}${whereSql}`;
          const stmt = db.prepare(updateSql);
          stmt.run(...setParams, ...whereParams);
        }

        const selectSql = `SELECT * FROM "${this.tableName}"${whereSql}`;
        const updated = db.prepare(selectSql).all(...whereParams);
        return { data: updated.length === 1 ? updated[0] : updated, error: null };
      }

      if (this.action === 'delete') {
        const { sql: whereSql, params: whereParams } = this.buildWhere();
        const countStmt = db.prepare(`SELECT COUNT(*) as count FROM "${this.tableName}"${whereSql}`);
        const countRes = countStmt.get(...whereParams) as { count: number };

        const delSql = `DELETE FROM "${this.tableName}"${whereSql}`;
        db.prepare(delSql).run(...whereParams);

        return { data: null, error: null, count: countRes.count };
      }

      // Action: SELECT
      const { sql: whereSql, params: whereParams } = this.buildWhere();
      let sql = `SELECT * FROM "${this.tableName}"${whereSql}`;

      if (this.orderClauses.length > 0) {
        const orderPart = this.orderClauses.map(o => `"${o.col}" ${o.dir}`).join(', ');
        sql += ` ORDER BY ${orderPart}`;
      }

      if (this.limitCount !== undefined) {
        sql += ` LIMIT ${this.limitCount}`;
      }

      const stmt = db.prepare(sql);
      let rows = stmt.all(...whereParams) as any[];

      // Handle joins for user_cards if requested in select query (e.g. `*, user_cards(*)`)
      if (this.selectCols.includes('user_cards(*)') && (this.tableName === 'transactions' || this.tableName === 'brand_registrations' || this.tableName === 'offer_redemptions')) {
        const getCardStmt = db.prepare('SELECT * FROM user_cards WHERE id = ?');
        rows = rows.map(r => {
          if (r.user_card_id) {
            const card = getCardStmt.get(r.user_card_id);
            return { ...r, user_cards: card || null };
          }
          return { ...r, user_cards: null };
        });
      }

      // Convert is_active integer to boolean for user_cards
      if (this.tableName === 'user_cards') {
        rows = rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
      }

      let countResult: number | undefined = undefined;
      if (this.exactCount) {
        const countSql = `SELECT COUNT(*) as count FROM "${this.tableName}"${whereSql}`;
        const c = db.prepare(countSql).get(...whereParams) as { count: number };
        countResult = c.count;
      }

      return { data: rows, error: null, count: countResult };
    } catch (err: any) {
      console.error(`[LocalDB Error on ${this.tableName}]:`, err.message);
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }
}

export const localDb = {
  raw: db,
  from(tableName: string) {
    return new QueryBuilder(tableName);
  },
  getUserByUsernameOrEmail(identifier: string) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    return stmt.get(identifier.trim(), identifier.trim()) as any;
  },
  getUserById(id: string) {
    const stmt = db.prepare('SELECT id, username, full_name, email FROM users WHERE id = ?');
    return stmt.get(id) as any;
  },
  registerUser(username: string, password: string, fullName: string, email?: string) {
    const id = `u-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const userEmail = email || `${username}@cardio.local`;
    const insertStmt = db.prepare(`
      INSERT INTO users (id, username, password, full_name, email)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run(id, username, password, fullName, userEmail);

    const profileStmt = db.prepare(`
      INSERT INTO profiles (id, full_name, username)
      VALUES (?, ?, ?)
    `);
    profileStmt.run(id, fullName, username);

    return { id, username, full_name: fullName, email: userEmail };
  }
};
