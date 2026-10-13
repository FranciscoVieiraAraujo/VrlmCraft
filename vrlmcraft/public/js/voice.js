// Chat de VOZ via WebRTC. O servidor (WebSocket) so faz a sinalizacao;
// a voz trafega P2P entre os navegadores. Config de microfone e fone (saida).
window.Voice = (function () {
  let localStream = null;
  let enabled = false;
  let outputDeviceId = null;
  const peers = {};        // peerId -> RTCPeerConnection
  const audios = {};       // peerId -> <audio>
  const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  async function listDevices() {
    try {
      // precisa de permissao para expor labels
      const devs = await navigator.mediaDevices.enumerateDevices();
      return {
        mics: devs.filter(d => d.kind === 'audioinput'),
        speakers: devs.filter(d => d.kind === 'audiooutput')
      };
    } catch (e) { return { mics: [], speakers: [] }; }
  }

  async function enableMic(deviceId) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false
      });
      enabled = true;
      return true;
    } catch (e) { console.warn('Microfone negado:', e.message); enabled = false; return false; }
  }

  function setOutput(deviceId) { outputDeviceId = deviceId; for (const id in audios) applyOutput(audios[id]); }
  function applyOutput(el) { if (outputDeviceId && el.setSinkId) el.setSinkId(outputDeviceId).catch(() => {}); }

  function makePeer(peerId, initiator) {
    if (peers[peerId]) return peers[peerId];
    const pc = new RTCPeerConnection(RTC_CFG);
    peers[peerId] = pc;
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => { if (e.candidate) Net.wsSend({ t: 'rtc-ice', to: peerId, cand: e.candidate }); };
    pc.ontrack = (e) => {
      let el = audios[peerId];
      if (!el) { el = new Audio(); el.autoplay = true; audios[peerId] = el; applyOutput(el); }
      el.srcObject = e.streams[0];
      // deteccao simples de fala para destacar quem fala
      watchTalk(peerId, e.streams[0]);
    };
    if (initiator) {
      pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => {
        Net.wsSend({ t: 'rtc-offer', to: peerId, sdp: pc.localDescription });
      });
    }
    return pc;
  }

  async function onOffer(from, sdp) {
    const pc = makePeer(from, false);
    await pc.setRemoteDescription(sdp);
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    Net.wsSend({ t: 'rtc-answer', to: from, sdp: pc.localDescription });
  }
  async function onAnswer(from, sdp) { const pc = peers[from]; if (pc) await pc.setRemoteDescription(sdp); }
  async function onIce(from, cand) { const pc = peers[from]; if (pc) { try { await pc.addIceCandidate(cand); } catch (e) {} } }

  function connectTo(peerId) { if (enabled) makePeer(peerId, true); }
  function drop(peerId) { if (peers[peerId]) { peers[peerId].close(); delete peers[peerId]; } if (audios[peerId]) { audios[peerId].srcObject = null; delete audios[peerId]; } }

  // analisador de volume para indicar quem esta falando
  const talkCbs = [];
  function onTalk(cb) { talkCbs.push(cb); }
  function watchTalk(peerId, stream) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      setInterval(() => {
        an.getByteFrequencyData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
        const talking = (sum / buf.length) > 18;
        talkCbs.forEach(cb => cb(peerId, talking));
      }, 250);
    } catch (e) {}
  }

  function isEnabled() { return enabled; }

  return { listDevices, enableMic, setOutput, connectTo, drop, onOffer, onAnswer, onIce, onTalk, isEnabled };
})();
