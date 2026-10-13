// Teste de runtime: sobe a logica real e valida DB (sql.js) + auth + mundos + evento,
// e faz um fluxo HTTP de verdade contra o app Express. Finaliza sozinho.
process.env.DB_FILE = './db/_test_runtime.db';
process.env.EVENT_HOUR = '19'; process.env.EVENT_MINUTE = '30';
const http = require('http');
const express = require('express');
const path = require('path');
const db = require('./src/db');
const auth = require('./src/auth');
const worlds = require('./src/worlds');
const events = require('./src/events');

function assert(c, m) { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('ok -', m); }

(async () => {
  try { require('fs').unlinkSync('./db/_test_runtime.db'); } catch (e) {}
  await db.init('./db/_test_runtime.db');
  worlds.ensureSeedScenarios();
  events.init();

  // --- logica direta ---
  const s1 = auth.register('joao', 'senha123', 'j@x.com');
  assert(s1.token && s1.user.username === 'joao', 'registro cria usuario e sessao');
  let threw = false; try { auth.register('joao', 'outra'); } catch (e) { threw = true; }
  assert(threw, 'nao permite usuario duplicado');
  const s2 = auth.login('joao', 'senha123');
  assert(s2.token, 'login com senha correta');
  threw = false; try { auth.login('joao', 'errada'); } catch (e) { threw = true; }
  assert(threw, 'rejeita senha errada');
  assert(auth.userFromToken(s1.token).username === 'joao', 'token resolve usuario');

  const w = worlds.saveWorld(s1.user.id, { name: 'Mundo 1', seed: 42, data: { overrides: { '1,5,1': 0 } } });
  assert(w.id && worlds.getWorld(w.id).data.overrides['1,5,1'] === 0, 'salva e le mundo com overrides');
  worlds.recordStats(s1.user.id, { blocks_broken: 20, wood_used: 10, depth_reached: 50 });
  const scen = worlds.generateScenarioFromStats();
  assert(scen.params && typeof scen.params.treeDensity === 'number', 'diretor gera cenario com parametros');
  assert(worlds.listScenarios().length >= 6, 'catalogo de cenarios padrao existe');

  const st = events.status();
  assert(st.active === false && st.eventTime === '19:30', 'evento agendado para 19:30');

  // --- fluxo HTTP real ---
  const app = express();
  app.use(express.json());
  app.post('/api/login', (req, res) => { try { res.json(auth.login(req.body.username, req.body.password)); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/me', auth.authMiddleware, (req, res) => res.json({ user: req.user }));
  app.get('/api/scenarios', (req, res) => res.json({ scenarios: worlds.listScenarios() }));
  const server = http.createServer(app);
  await new Promise(r => server.listen(15999, '127.0.0.1', r));

  const req = (opts, body) => new Promise((resolve) => {
    const r = http.request(Object.assign({ host: '127.0.0.1', port: 15999 }, opts), (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
    }); if (body) r.write(JSON.stringify(body)); r.end();
  });

  const login = await req({ method: 'POST', path: '/api/login', headers: { 'Content-Type': 'application/json' } }, { username: 'joao', password: 'senha123' });
  assert(login.status === 200 && login.body.token, 'HTTP login retorna token');
  const meRes = await req({ method: 'GET', path: '/api/me', headers: { Authorization: 'Bearer ' + login.body.token } });
  assert(meRes.status === 200 && meRes.body.user.username === 'joao', 'HTTP /me autenticado');
  const noAuth = await req({ method: 'GET', path: '/api/me' });
  assert(noAuth.status === 401, 'HTTP /me sem token = 401');
  const sc = await req({ method: 'GET', path: '/api/scenarios' });
  assert(sc.status === 200 && sc.body.scenarios.length >= 6, 'HTTP /scenarios lista cenarios');

  server.close();
  db.flush();
  console.log('\nTODOS OS TESTES PASSARAM');
  process.exit(0);
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
