// Autenticacao: registro, login, sessoes por token. Senhas com bcryptjs (puro JS).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias

function now() { return Date.now(); }
function uid() { return crypto.randomUUID(); }

function register(username, password, email) {
  username = String(username || '').trim();
  if (username.length < 3) throw new Error('Usuario precisa de ao menos 3 caracteres');
  if (String(password || '').length < 4) throw new Error('Senha muito curta');
  const exists = db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) throw new Error('Esse nome de usuario ja existe');
  const id = uid();
  const hash = bcrypt.hashSync(String(password), 10);
  db.run('INSERT INTO users (id, username, email, pass_hash, character_id, created_at, last_seen) VALUES (?,?,?,?,?,?,?)',
    [id, username, email || null, hash, 1, now(), now()]);
  return createSession(id);
}

function login(username, password) {
  const u = db.get('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
  if (!u) throw new Error('Usuario ou senha invalidos');
  if (!bcrypt.compareSync(String(password), u.pass_hash)) throw new Error('Usuario ou senha invalidos');
  db.run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), u.id]);
  return createSession(u.id);
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
    [token, userId, now(), now() + SESSION_TTL]);
  const user = publicUser(userId);
  return { token, user };
}

function userFromToken(token) {
  if (!token) return null;
  const s = db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!s) return null;
  if (s.expires_at < now()) { db.run('DELETE FROM sessions WHERE token = ?', [token]); return null; }
  return publicUser(s.user_id);
}

function publicUser(id) {
  const u = db.get('SELECT id, username, email, character_id, created_at FROM users WHERE id = ?', [id]);
  return u || null;
}

function logout(token) {
  if (token) db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

function setCharacter(userId, characterId) {
  db.run('UPDATE users SET character_id = ? WHERE id = ?', [characterId | 0, userId]);
}

// Middleware express
function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Nao autenticado' });
  req.user = user; req.token = token;
  next();
}

module.exports = { register, login, logout, userFromToken, publicUser, setCharacter, authMiddleware };
