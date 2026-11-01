import Database from 'better-sqlite3';

const db = new Database('badshah.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY, symbol TEXT, tf TEXT, dir TEXT, score INTEGER,
  grade TEXT, reasons TEXT, entry REAL, expiry INTEGER,
  exit REAL, outcome TEXT, created INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pending ON signals(outcome, expiry);
`);

export const insertSignal = db.prepare(`
  INSERT INTO signals (symbol, tf, dir, score, grade, reasons, entry, expiry, created)
  VALUES (@symbol, @tf, @dir, @score, @grade, @reasons, @entry, @expiry, @created)
`);

export const pendingBefore = db.prepare(
  `SELECT * FROM signals WHERE outcome IS NULL AND expiry <= ? LIMIT 50`);

export const resolveSignal = db.prepare(
  `UPDATE signals SET exit = @exit, outcome = @outcome WHERE id = @id`);

export const recentSignals = db.prepare(
  `SELECT * FROM signals ORDER BY id DESC LIMIT ?`);

export const stats = db.prepare(`
  SELECT COUNT(*) AS total,
         SUM(outcome = 'win') AS wins,
         SUM(outcome = 'loss') AS losses,
         SUM(outcome = 'push') AS pushes
  FROM signals WHERE outcome IS NOT NULL`);

export const statsByGrade = db.prepare(`
  SELECT grade, COUNT(*) AS total, SUM(outcome = 'win') AS wins
  FROM signals WHERE outcome IS NOT NULL GROUP BY grade`);

export default db;