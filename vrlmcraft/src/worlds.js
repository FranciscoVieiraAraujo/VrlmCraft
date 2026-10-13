// Mundos salvos pelo jogador + \"diretor de cenarios\" (IA procedural).
// O diretor NAO usa LLM: ele le as estatisticas agregadas de como as pessoas
// jogam (o que quebram, cavam, constroem) e gera novos cenarios PADRAO,
// variando parametros de bioma/estruturas de forma organica (ruido + mutacao),
// para que nunca fique robotico. Dia e noite seguem o horario LOCAL do cliente.
const crypto = require('crypto');
const db = require('./db');

function now() { return Date.now(); }
function uid() { return crypto.randomUUID(); }
function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---- Mundos do jogador ----
function listWorlds(userId) {
  return db.all('SELECT id,name,seed,is_shared,updated_at FROM worlds WHERE owner_id = ? ORDER BY updated_at DESC', [userId]);
}
function getWorld(id) {
  const w = db.get('SELECT * FROM worlds WHERE id = ?', [id]);
  if (w && w.data) { try { w.data = JSON.parse(w.data); } catch (e) { w.data = {}; } }
  return w;
}
function saveWorld(userId, { id, name, seed, data, is_shared }) {
  const t = now();
  if (id) {
    const w = db.get('SELECT owner_id FROM worlds WHERE id = ?', [id]);
    if (!w || w.owner_id !== userId) throw new Error('Mundo nao encontrado');
    db.run('UPDATE worlds SET name=?, data=?, is_shared=?, updated_at=? WHERE id=?',
      [name, JSON.stringify(data || {}), is_shared ? 1 : 0, t, id]);
    return getWorld(id);
  }
  const nid = uid();
  db.run('INSERT INTO worlds (id,owner_id,name,seed,is_shared,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    [nid, userId, name || 'Novo Mundo', (seed | 0) || rint(1, 2e9), is_shared ? 1 : 0, JSON.stringify(data || {}), t, t]);
  return getWorld(nid);
}
function deleteWorld(userId, id) {
  db.run('DELETE FROM worlds WHERE id = ? AND owner_id = ?', [id, userId]);
}

// ---- Estatisticas de jogabilidade ----
function recordStats(userId, s) {
  db.run(`INSERT INTO play_stats (user_id,blocks_broken,blocks_placed,depth_reached,water_used,wood_used,stone_used,torches_used,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, s.blocks_broken|0, s.blocks_placed|0, s.depth_reached|0, s.water_used|0, s.wood_used|0, s.stone_used|0, s.torches_used|0, now()]);
  maybeRunDirector();
}

// ---- Cenarios padrao (compartilhados) ----
function listScenarios(limit = 24) {
  return db.all('SELECT id,name,seed,params,origin,plays,created_at FROM scenarios ORDER BY plays DESC, created_at DESC LIMIT ?', [limit])
    .map(r => { try { r.params = JSON.parse(r.params); } catch (e) { r.params = {}; } return r; });
}
function bumpScenarioPlays(id) { db.run('UPDATE scenarios SET plays = plays + 1 WHERE id = ?', [id]); }

// Nomes gerados de forma organica (nada robotico)
const ADJ = ['Sereno','Nebuloso','Dourado','Profundo','Antigo','Vivo','Tranquilo','Selvagem','Oculto','Florido','Gelado','Ardente'];
const NOUN = ['Vale','Planalto','Bosque','Litoral','Caverna','Pradaria','Cume','Delta','Clareira','Abismo','Jardim','Horizonte'];
function organicName() { return ADJ[rint(0, ADJ.length-1)] + ' ' + NOUN[rint(0, NOUN.length-1)]; }

// O diretor: le medias recentes e cria um cenario que \"responde\" ao estilo de jogo
function generateScenarioFromStats() {
  const agg = db.get(`SELECT
      AVG(blocks_broken) b, AVG(blocks_placed) p, AVG(depth_reached) d,
      AVG(water_used) w, AVG(wood_used) wd, AVG(stone_used) st, AVG(torches_used) tc,
      COUNT(*) n
    FROM (SELECT * FROM play_stats ORDER BY created_at DESC LIMIT 200)`) || {};
  const n = agg.n || 0;
  // base + vies pelo comportamento + ruido organico (mutacao)
  const jitter = () => (Math.random() - 0.5) * 0.25;
  const params = {
    // mais lenha usada => mais arvores; mais pedra => mais montanhas; mais agua => mais rios
    treeDensity: clamp(0.05 + (agg.wd || 0) / 400 + jitter(), 0.02, 0.45),
    mountainAmp:  clamp(3 + (agg.st || 0) / 25 + jitter() * 4, 2, 14),
    riverFreq:    clamp(0.18 + (agg.w || 0) / 500 + jitter() * 0.1, 0.08, 0.4),
    oreRichness:  clamp(0.04 + (agg.b || 0) / 2000 + jitter() * 0.05, 0.02, 0.2),
    caveLava:     clamp(0.3 + (agg.d || 0) / 120 + jitter() * 0.2, 0.1, 0.9),
    sandiness:    clamp(0.1 + jitter() * 0.3, 0.02, 0.5),
    // dia/noite organico: duracao do ciclo varia um pouco (minutos de jogo),
    // mas o relogio real do cliente e quem manda (ver cliente).
    dayStyle: ['ensolarado','nuvens','por-do-sol-longo','amanhecer-brumoso'][rint(0,3)]
  };
  const id = uid();
  db.run('INSERT INTO scenarios (id,name,seed,params,origin,plays,created_at) VALUES (?,?,?,?,?,?,?)',
    [id, organicName(), rint(1, 2e9), JSON.stringify(params), n ? 'director' : 'base', 0, now()]);
  return getScenario(id);
}
function getScenario(id) {
  const r = db.get('SELECT * FROM scenarios WHERE id = ?', [id]);
  if (r) { try { r.params = JSON.parse(r.params); } catch (e) { r.params = {}; } }
  return r;
}

// Roda o diretor de vez em quando (nao a cada partida) para gerar novos padroes
let lastDirector = 0;
function maybeRunDirector() {
  const t = now();
  if (t - lastDirector < 1000 * 60 * 20) return; // no maximo a cada 20 min
  lastDirector = t;
  const total = db.get('SELECT COUNT(*) c FROM scenarios').c || 0;
  if (total < 60) generateScenarioFromStats(); // mantem um catalogo vivo
}

// Garante um conjunto inicial de cenarios padrao na primeira execucao
function ensureSeedScenarios() {
  const total = db.get('SELECT COUNT(*) c FROM scenarios').c || 0;
  if (total === 0) { for (let i = 0; i < 6; i++) generateScenarioFromStats(); }
}

module.exports = {
  listWorlds, getWorld, saveWorld, deleteWorld,
  recordStats, listScenarios, bumpScenarioPlays, getScenario,
  generateScenarioFromStats, ensureSeedScenarios
};
