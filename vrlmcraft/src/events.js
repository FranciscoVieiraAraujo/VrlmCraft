// Evento diario (padrao 19:30, hora LOCAL do servidor), duracao 60 min.
// Durante o evento: varios jogadores no mesmo cenario, presentes espalhados,
// e um jogador pode \"pegar\" de outro o presente que ele coletou. No fim,
// cada um volta para sua conta e da continuidade (ou sai).
const crypto = require('crypto');
const db = require('./db');
const worlds = require('./worlds');

function now() { return Date.now(); }
function uid() { return crypto.randomUUID(); }

const EVENT_HOUR = parseInt(process.env.EVENT_HOUR || '19', 10);
const EVENT_MIN = parseInt(process.env.EVENT_MINUTE || '30', 10);
const DURATION = parseInt(process.env.EVENT_DURATION_MIN || '60', 10) * 60 * 1000;

let current = null; // { id, startsAt, endsAt, scenario }
const listeners = new Set();
function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { for (const cb of listeners) { try { cb(status()); } catch (e) {} } }

// proximo horario 19:30 (hoje ou amanha)
function nextStart() {
  const d = new Date();
  d.setHours(EVENT_HOUR, EVENT_MIN, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function startEvent() {
  const scenario = worlds.generateScenarioFromStats(); // cenario novo e organico para o evento
  const id = uid();
  const startsAt = Date.now();
  const endsAt = startsAt + DURATION;
  current = { id, startsAt, endsAt, scenario };
  db.run('INSERT INTO events (id,starts_at,ends_at,scenario_id,status) VALUES (?,?,?,?,?)',
    [id, startsAt, endsAt, scenario.id, 'running']);
  emit();
  setTimeout(endEvent, DURATION);
}

function endEvent() {
  if (!current) return;
  db.run("UPDATE events SET status='finished' WHERE id = ?", [current.id]);
  current = null;
  emit();
  scheduleNext();
}

let timer = null;
function scheduleNext() {
  if (timer) clearTimeout(timer);
  const wait = nextStart() - Date.now();
  timer = setTimeout(startEvent, Math.max(1000, wait));
}

function status() {
  if (current) {
    return { active: true, id: current.id, startsAt: current.startsAt, endsAt: current.endsAt,
             remainingMs: Math.max(0, current.endsAt - Date.now()), scenario: current.scenario };
  }
  return { active: false, nextStartsAt: nextStart(), eventTime: `${String(EVENT_HOUR).padStart(2,'0')}:${String(EVENT_MIN).padStart(2,'0')}` };
}

// ---- Presentes ----
const GIFT_KINDS = ['ferro','madeira','pedra','agua','areia','tocha','diamante','pocao'];
function randomGiftKind() { return GIFT_KINDS[Math.floor(Math.random() * GIFT_KINDS.length)]; }

// jogador coleta um presente no evento
function collectGift(userId, kind) {
  if (!current) throw new Error('Nenhum evento ativo');
  const id = uid();
  const k = GIFT_KINDS.includes(kind) ? kind : randomGiftKind();
  db.run('INSERT INTO gifts (id,owner_id,kind,amount,from_event,created_at,consumed) VALUES (?,?,?,?,?,?,0)',
    [id, userId, k, 1, 1, now()]);
  return { id, kind: k };
}

// jogador A pega de jogador B um presente que B coletou (so durante evento)
function stealGift(fromUserId, toUserId) {
  if (!current) throw new Error('Nenhum evento ativo');
  const g = db.get('SELECT * FROM gifts WHERE owner_id = ? AND from_event = 1 AND consumed = 0 ORDER BY created_at DESC LIMIT 1', [fromUserId]);
  if (!g) throw new Error('Esse jogador nao tem presentes do evento');
  db.run('UPDATE gifts SET owner_id = ?, stolen_from = ? WHERE id = ?', [toUserId, fromUserId, g.id]);
  return { id: g.id, kind: g.kind, stolenFrom: fromUserId };
}

// inventario de presentes para usar jogando sozinho depois
function myGifts(userId) {
  return db.all('SELECT id,kind,amount,stolen_from,created_at,consumed FROM gifts WHERE owner_id = ? AND consumed = 0 ORDER BY created_at DESC', [userId]);
}
function useGift(userId, giftId) {
  const g = db.get('SELECT * FROM gifts WHERE id = ? AND owner_id = ?', [giftId, userId]);
  if (!g) throw new Error('Presente nao encontrado');
  db.run('UPDATE gifts SET consumed = 1 WHERE id = ?', [giftId]);
  return { kind: g.kind, amount: g.amount };
}

function init() { scheduleNext(); }

module.exports = { init, status, onChange, collectGift, stealGift, myGifts, useGift, randomGiftKind, GIFT_KINDS };
