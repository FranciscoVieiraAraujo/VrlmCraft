// Cliente de rede: REST (contas, mundos, cenarios, evento) + WebSocket (tempo real).
window.Net = (function () {
  let token = localStorage.getItem('vc_token') || null;
  let ws = null, wsHandlers = {}, myPeerId = null;

  function setToken(t) { token = t; if (t) localStorage.setItem('vc_token', t); else localStorage.removeItem('vc_token'); }
  function getToken() { return token; }

  async function api(path, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    return data;
  }

  // ---- WebSocket ----
  function on(type, cb) { wsHandlers[type] = cb; }
  function connectWS(room) {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(proto + '://' + location.host + '/ws');
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, room }));
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'joined') { myPeerId = m.peerId; resolve(m); }
        const h = wsHandlers[m.t]; if (h) h(m);
      };
      ws.onerror = (e) => reject(new Error('Falha no WebSocket'));
      ws.onclose = () => { if (wsHandlers.close) wsHandlers.close(); };
    });
  }
  function wsSend(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function peerId() { return myPeerId; }
  function disconnectWS() { if (ws) { try { ws.close(); } catch (e) {} ws = null; } }

  return {
    setToken, getToken, api, on, connectWS, wsSend, peerId, disconnectWS,
    register: (u, p, e) => api('/register', 'POST', { username: u, password: p, email: e }),
    login: (u, p) => api('/login', 'POST', { username: u, password: p }),
    logout: () => api('/logout', 'POST'),
    me: () => api('/me'),
    setCharacter: (id) => api('/character', 'POST', { characterId: id }),
    worlds: () => api('/worlds'),
    getWorld: (id) => api('/worlds/' + id),
    saveWorld: (w) => api('/worlds', 'POST', w),
    delWorld: (id) => api('/worlds/' + id, 'DELETE'),
    scenarios: () => api('/scenarios'),
    playScenario: (id) => api('/scenarios/' + id + '/play', 'POST'),
    sendStats: (s) => api('/stats', 'POST', s),
    event: () => api('/event'),
    collectGift: (kind) => api('/event/gift', 'POST', { kind }),
    stealGift: (fromUserId) => api('/event/steal', 'POST', { fromUserId }),
    gifts: () => api('/gifts'),
    useGift: (id) => api('/gifts/' + id + '/use', 'POST')
  };
})();
