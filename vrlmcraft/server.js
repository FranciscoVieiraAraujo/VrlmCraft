// VRLMCraft Online - servidor HTTP + REST + WebSocket.
// Serve o jogo (navegador) e cuida de contas, mundos, cenarios, evento e tempo real.
const path = require('path');
const http = require('http');
const express = require('express');

const db = require('./src/db');
const auth = require('./src/auth');
const worlds = require('./src/worlds');
const events = require('./src/events');
const realtime = require('./src/realtime');

// carregador .env minimo (sem dependencia)
function loadDotEnv() {
  const fs = require('fs');
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['\"]|['\"]$/g, '');
  }
}
loadDotEnv();

const PORT = parseInt(process.env.PORT || '15800', 10);
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db', 'vrlmcraft.db');

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  try { res.json(auth.register(req.body.username, req.body.password, req.body.email)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/login', (req, res) => {
  try { res.json(auth.login(req.body.username, req.body.password)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/logout', auth.authMiddleware, (req, res) => { auth.logout(req.token); res.json({ ok: true }); });
app.get('/api/me', auth.authMiddleware, (req, res) => res.json({ user: req.user }));
app.post('/api/character', auth.authMiddleware, (req, res) => {
  auth.setCharacter(req.user.id, req.body.characterId); res.json({ ok: true });
});

// ---------- Mundos ----------
app.get('/api/worlds', auth.authMiddleware, (req, res) => res.json({ worlds: worlds.listWorlds(req.user.id) }));
app.get('/api/worlds/:id', auth.authMiddleware, (req, res) => {
  const w = worlds.getWorld(req.params.id);
  if (!w) return res.status(404).json({ error: 'Nao encontrado' });
  res.json({ world: w });
});
app.post('/api/worlds', auth.authMiddleware, (req, res) => {
  try { res.json({ world: worlds.saveWorld(req.user.id, req.body) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/worlds/:id', auth.authMiddleware, (req, res) => { worlds.deleteWorld(req.user.id, req.params.id); res.json({ ok: true }); });

// ---------- Cenarios padrao / diretor (IA procedural) ----------
app.get('/api/scenarios', (req, res) => res.json({ scenarios: worlds.listScenarios() }));
app.post('/api/scenarios/:id/play', (req, res) => { worlds.bumpScenarioPlays(req.params.id); res.json({ ok: true }); });
app.post('/api/stats', auth.authMiddleware, (req, res) => { worlds.recordStats(req.user.id, req.body || {}); res.json({ ok: true }); });

// ---------- Evento 19:30 ----------
app.get('/api/event', (req, res) => res.json(events.status()));
app.post('/api/event/gift', auth.authMiddleware, (req, res) => {
  try { res.json(events.collectGift(req.user.id, req.body.kind)); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/event/steal', auth.authMiddleware, (req, res) => {
  try { res.json(events.stealGift(req.body.fromUserId, req.user.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/gifts', auth.authMiddleware, (req, res) => res.json({ gifts: events.myGifts(req.user.id) }));
app.post('/api/gifts/:id/use', auth.authMiddleware, (req, res) => {
  try { res.json(events.useGift(req.user.id, req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

const server = http.createServer(app);
realtime.attach(server);

(async () => {
  await db.init(DB_FILE);
  worlds.ensureSeedScenarios();
  events.init();
  server.listen(PORT, () => {
    console.log(`VRLMCraft Online rodando em http://127.0.0.1:${PORT}`);
    console.log(`Banco: ${DB_FILE}`);
  });
})();

process.on('SIGINT', () => { try { db.flush(); } catch (e) {} process.exit(0); });
process.on('SIGTERM', () => { try { db.flush(); } catch (e) {} process.exit(0); });
