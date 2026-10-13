// Interface do menu: login/registro, personagem, modo, mundos, cenarios, voz, evento.
(function () {
  const $ = (s) => document.querySelector(s);
  const show = (el, on) => { el.classList[on ? 'remove' : 'add']('hidden'); };
  let me = null, chosenChar = 1, mode = 'solo', worldId = null, scenarios = [], invite = null;

  // ---- Abas login/registro ----
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); t.classList.add('active');
    show($('#pane-login'), t.dataset.tab === 'login'); show($('#pane-reg'), t.dataset.tab === 'reg');
  });
  function authErr(m) { $('#auth-err').textContent = m || ''; }

  $('#btn-login').onclick = async () => {
    try { const r = await Net.login($('#li-user').value, $('#li-pass').value); Net.setToken(r.token); me = r.user; enterMenu(); }
    catch (e) { authErr(e.message); }
  };
  $('#btn-reg').onclick = async () => {
    try { const r = await Net.register($('#rg-user').value, $('#rg-pass').value, $('#rg-email').value); Net.setToken(r.token); me = r.user; enterMenu(); }
    catch (e) { authErr(e.message); }
  };
  $('#btn-logout').onclick = async (e) => { e.preventDefault(); try { await Net.logout(); } catch (x) {} Net.setToken(null); location.reload(); };

  // ---- Entrar no menu apos login ----
  async function enterMenu() {
    authErr(''); show($('#authbox'), false); show($('#menu'), true);
    $('#me-name').textContent = me.username; chosenChar = me.character_id || 1;
    renderChars(); await loadWorlds(); await loadScenarios(); await refreshEvent(); setupAudio();
  }

  // ---- Personagens ----
  function renderChars() {
    const box = $('#charpick'); box.innerHTML = '';
    window.CHARACTERS.forEach(c => {
      const d = document.createElement('div'); d.className = 'ch' + (c.id === chosenChar ? ' sel' : '');
      d.innerHTML = `<div class="av" style="background:#${c.color.toString(16).padStart(6,'0')}"></div><b>${c.name}</b><div class="tool">${c.tool}</div><small>${c.perk}</small>`;
      d.onclick = () => { chosenChar = c.id; renderChars(); Net.setCharacter(c.id).catch(()=>{}); };
      box.appendChild(d);
    });
  }

  // ---- Modos ----
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
    document.querySelectorAll('.mode').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); mode = b.dataset.mode;
    show($('#invite-row'), mode === 'invite');
  });
  document.querySelector('.mode[data-mode="solo"]').classList.add('sel');
  $('#btn-makecode').onclick = () => { invite = Math.random().toString(36).slice(2, 6).toUpperCase(); $('#invite-code').value = invite; };

  // ---- Mundos ----
  async function loadWorlds() {
    const sel = $('#world-select'); sel.innerHTML = '<option value="">(mundo novo aleatorio)</option>';
    try { const r = await Net.worlds(); r.worlds.forEach(w => { const o = document.createElement('option'); o.value = w.id; o.textContent = w.name; sel.appendChild(o); }); } catch (e) {}
  }
  $('#btn-newworld').onclick = () => { $('#world-select').value = ''; worldId = null; };
  $('#btn-delworld').onclick = async () => { const id = $('#world-select').value; if (!id) return; await Net.delWorld(id).catch(()=>{}); worldId = null; await loadWorlds(); };

  // ---- Cenarios padrao (IA) ----
  async function loadScenarios() {
    const sel = $('#scenario-select'); sel.innerHTML = '<option value="">(automatico)</option>';
    try { const r = await Net.scenarios(); scenarios = r.scenarios; scenarios.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' · ' + (s.plays||0) + ' jogadas'; sel.appendChild(o); }); } catch (e) {}
  }

  // ---- Audio / voz ----
  async function setupAudio() {
    const micChk = $('#opt-mic'), micSel = $('#mic-select'), spkSel = $('#spk-select');
    micChk.onchange = async () => {
      if (micChk.checked) { const ok = await Voice.enableMic(micSel.value || null); if (!ok) { micChk.checked = false; alert('Microfone negado pelo navegador.'); return; } await listDevices(); }
    };
    spkSel.onchange = () => Voice.setOutput(spkSel.value || null);
    $('#opt-music').onchange = (e) => Game.setMusic(e.target.checked);
    async function listDevices() {
      const d = await Voice.listDevices();
      micSel.innerHTML = ''; d.mics.forEach(m => { const o = document.createElement('option'); o.value = m.deviceId; o.textContent = m.label || 'Microfone'; micSel.appendChild(o); });
      spkSel.innerHTML = ''; d.speakers.forEach(m => { const o = document.createElement('option'); o.value = m.deviceId; o.textContent = m.label || 'Fone/Alto-falante'; spkSel.appendChild(o); });
    }
    listDevices();
    Voice.onTalk((peerId, talking) => { const el = document.querySelector('#peers .peer[data-p="'+peerId+'"]'); if (el) el.classList[talking?'add':'remove']('talk'); });
  }

  // ---- Evento 19:30 ----
  async function refreshEvent() {
    try {
      const s = await Net.event(); const b = $('#event-banner');
      if (s.active) { show(b, true); b.innerHTML = '🎉 EVENTO ACONTECENDO AGORA! Entre para pegar presentes · termina em ' + Math.ceil(s.remainingMs/60000) + ' min'; }
      else { show(b, true); b.innerHTML = '⏰ Proximo evento diario as ' + (s.eventTime||'19:30') + '. Varios jogadores, presentes e musica animada por 1 hora.'; }
    } catch (e) {}
    setTimeout(refreshEvent, 30000);
  }

  // ---- Jogar ----
  $('#btn-play').onclick = async () => {
    const sel = $('#world-select').value; let opts = { mode, music: $('#opt-music').checked, p2char: 2 };
    opts.character = window.CHARACTERS.find(c => c.id === chosenChar);
    if (sel) { try { const r = await Net.getWorld(sel); const w = r.world; opts.worldId = w.id; opts.worldName = w.name; opts.seed = w.seed; opts.overrides = (w.data&&w.data.overrides)||{}; opts.params = (w.data&&w.data.params)||{}; } catch (e) {} }
    else { const sc = $('#scenario-select').value; const scen = scenarios.find(s => s.id === sc) || scenarios[Math.floor(Math.random()*scenarios.length)]; if (scen) { opts.seed = scen.seed; opts.params = scen.params; opts.worldName = scen.name; Net.playScenario(scen.id).catch(()=>{}); } }
    if (mode === 'online') opts.room = 'global';
    if (mode === 'invite') { const code = ($('#invite-code').value || invite || 'SALA').toUpperCase(); opts.room = 'invite-' + code; }
    show($('#overlay'), false);
    Game.init(opts);
    // aplica presentes ganhos (para usar jogando sozinho)
    try { const g = await Net.gifts(); if (g.gifts && g.gifts.length && mode === 'solo') { for (const gift of g.gifts) { await Net.useGift(gift.id).catch(()=>{}); Game.giveGift(gift.kind, gift.amount || 1); } } } catch (e) {}
  };

  // ---- Auto-login se ja tem token ----
  (async () => { if (Net.getToken()) { try { const r = await Net.me(); me = r.user; enterMenu(); } catch (e) { Net.setToken(null); } } })();
})();
