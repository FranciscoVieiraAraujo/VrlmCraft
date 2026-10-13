// Camada de banco de dados usando sql.js (SQLite em WebAssembly, 100% JS, sem compilador).
// O banco inteiro vive em memoria e e persistido num unico arquivo (DB_FILE),
// entao basta \"levar o arquivo junto\" no deploy para manter os dados de todos.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let SQL = null;
let db = null;
let dbFile = null;
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const data = Buffer.from(db.export());
      fs.mkdirSync(path.dirname(dbFile), { recursive: true });
      const tmp = dbFile + '.tmp';
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, dbFile); // escrita atomica
    } catch (e) {
      console.error('[db] falha ao salvar:', e.message);
    }
  }, 400);
}

async function init(file) {
  dbFile = file || path.join(__dirname, '..', 'db', 'vrlmcraft.db');
  SQL = await initSqlJs();
  if (fs.existsSync(dbFile)) {
    db = new SQL.Database(fs.readFileSync(dbFile));
  } else {
    db = new SQL.Database();
  }
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  db.run(schema);
  scheduleSave();
  return module.exports;
}

// Executa comando (INSERT/UPDATE/DELETE)
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  scheduleSave();
}

// Retorna uma linha (objeto) ou null
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

// Retorna todas as linhas (array de objetos)
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const data = Buffer.from(db.export());
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, data);
}

module.exports = { init, run, get, all, flush };
