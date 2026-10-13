// Servidor de tempo real (WebSocket): presenca, posicoes dos jogadores,
// edicoes de blocos no mesmo cenario, chat de texto e SINALIZACAO WebRTC
// (troca de offer/answer/ICE) para o chat de VOZ entre os jogadores.
// A voz em si trafega P2P (navegador<->navegador); o servidor so apresenta os pares.
const { WebSocketServer } = require('ws');
const auth = require('./auth');

// rooms: Map<roomId, Map<peerId, {ws, user, pos}>>
const rooms = new Map();

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
function broadcast(roomId, obj, exceptPeer) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [pid, m] of room) { if (pid !== exceptPeer) send(m.ws, obj); }
}
function roster(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.entries()].map(([pid, m]) => ({ peerId: pid, name: m.user.username, character: m.user.character_id, pos: m.pos }));
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let peerId = null, roomId = null, user = null;

    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch (e) { return; }

      if (msg.t === 'join') {
        user = auth.userFromToken(msg.token);
        if (!user) return send(ws, { t: 'error', m: 'Sessao invalida' });
        roomId = String(msg.room || 'global');
        peerId = Math.random().toString(36).slice(2, 10);
        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        rooms.get(roomId).set(peerId, { ws, user, pos: { x: 0, y: 18, z: 0 } });
        send(ws, { t: 'joined', peerId, room: roomId, roster: roster(roomId) });
        broadcast(roomId, { t: 'peer-join', peerId, name: user.username, character: user.character_id }, peerId);
        return;
      }
      if (!peerId || !roomId) return;

      switch (msg.t) {
        case 'pos': { // posicao do jogador
          const m = rooms.get(roomId)?.get(peerId);
          if (m) m.pos = msg.pos;
          broadcast(roomId, { t: 'pos', peerId, pos: msg.pos, yaw: msg.yaw }, peerId);
          break;
        }
        case 'block': // edicao de bloco (colocar/remover)
          broadcast(roomId, { t: 'block', peerId, x: msg.x, y: msg.y, z: msg.z, id: msg.id, op: msg.op }, peerId);
          break;
        case 'chat':
          broadcast(roomId, { t: 'chat', peerId, name: user.username, m: String(msg.m || '').slice(0, 300) });
          break;
        case 'gift': // avisa que pegou/roubou presente
          broadcast(roomId, { t: 'gift', peerId, name: user.username, kind: msg.kind, from: msg.from || null });
          break;
        // ---- Sinalizacao WebRTC para voz ----
        case 'rtc-offer':
          relay(roomId, msg.to, { t: 'rtc-offer', from: peerId, sdp: msg.sdp });
          break;
        case 'rtc-answer':
          relay(roomId, msg.to, { t: 'rtc-answer', from: peerId, sdp: msg.sdp });
          break;
        case 'rtc-ice':
          relay(roomId, msg.to, { t: 'rtc-ice', from: peerId, cand: msg.cand });
          break;
      }
    });

    ws.on('close', () => {
      if (roomId && peerId && rooms.has(roomId)) {
        rooms.get(roomId).delete(peerId);
        broadcast(roomId, { t: 'peer-left', peerId });
        if (rooms.get(roomId).size === 0) rooms.delete(roomId);
      }
    });
  });

  function relay(roomId, toPeer, obj) {
    const m = rooms.get(roomId)?.get(toPeer);
    if (m) send(m.ws, obj);
  }

  return wss;
}

module.exports = { attach };
