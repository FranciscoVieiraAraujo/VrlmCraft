// ===================== VRLMCraft Online - motor do jogo (Three.js) =====================
// Personagens com ferramentas, inimigos, tunel ate o centro da Terra com larvas de lava,
// dia/noite pelo horario LOCAL, construcao, tochas, salvar mundo, multiplayer e evento.

// ---- Personagens (cada um com uma ferramenta/habilidade) ----
window.CHARACTERS = [
  { id:1, name:'Mineiro',    color:0x6fa8dc, tool:'Picareta de Ferro', perk:'minera pedra/ferro mais rapido', fast:'stone' },
  { id:2, name:'Lenhador',   color:0x8b5a2b, tool:'Machado',           perk:'corta madeira mais rapido',     fast:'wood'  },
  { id:3, name:'Construtor', color:0xf0c419, tool:'Martelo',           perk:'coloca blocos mais rapido',     fast:'place' },
  { id:4, name:'Explorador', color:0x2ecc71, tool:'Pa',                perk:'cava areia/terra e tunel rapido', fast:'dig' },
  { id:5, name:'Aguadeiro',  color:0x3498db, tool:'Balde',             perk:'coleta e usa agua',             fast:'water' },
  { id:6, name:'Tocheiro',   color:0xe67e22, tool:'Lanterna',          perk:'tochas iluminam mais',          fast:'torch' }
];

// ---- Blocos ----
window.BLOCKS = {
  1:{n:'Grama',c:'#5da843',v:0x5da843}, 2:{n:'Terra',c:'#8b633f',v:0x8b633f},
  3:{n:'Pedra',c:'#777d82',v:0x777d82}, 4:{n:'Madeira',c:'#86522c',v:0x86522c},
  5:{n:'Folhas',c:'#2e7d32',v:0x2e7d32}, 6:{n:'Areia',c:'#d8c184',v:0xd8c184},
  7:{n:'Agua',c:'#2f80d0',v:0x2f80d0,liquid:1}, 8:{n:'Ferro',c:'#c0a994',v:0xc0a994},
  9:{n:'Diamante',c:'#48d9e9',v:0x48d9e9}, 10:{n:'Carvao',c:'#22252a',v:0x22252a},
  11:{n:'Tocha',c:'#ffcc33',v:0xffcc33,light:1}, 12:{n:'Lava',c:'#ef4b18',v:0xef4b18,liquid:1},
  13:{n:'Rocha Profunda',c:'#3a3f45',v:0x3a3f45}, 14:{n:'Nucleo',c:'#ff7b00',v:0xff7b00,light:1}
};

window.Game = (function () {
  let THREE = window.THREE;
  let scene, camera, renderer, canvas;
  let audioCtx = null, musicNode = null, musicOn = true, footTimer = 0;
  let opts = {}, running = false;
  let onReady = null;

  // ---------- Audio procedural (sem arquivos externos; evento com musica animada) ----------
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function blip(type) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    const map = {
      step:  ['triangle', 90, 60, 0.06, 0.05],
      break: ['square',  150, 35, 0.08, 0.22],
      place: ['sine',    220, 330,0.07, 0.14],
      torch: ['sawtooth',320, 180,0.09, 0.18],
      hurt:  ['square',  200, 70, 0.10, 0.25],
      gift:  ['sine',    523, 880,0.10, 0.30],
      dig:   ['square',  120, 50, 0.07, 0.10]
    };
    const p = map[type] || map.step;
    o.type = p[0]; o.frequency.setValueAtTime(p[1], t);
    o.frequency.exponentialRampToValueAtTime(p[2], t + p[4]);
    g.gain.setValueAtTime(p[3], t); g.gain.linearRampToValueAtTime(0, t + p[4]);
    o.start(t); o.stop(t + p[4]);
  }
  // musica animada para o evento (loop de sintetizador alegre)
  let musicTimer = null;
  function startMusic(fast) {
    if (!audioCtx || !musicOn) return;
    stopMusic();
    const notes = fast ? [523,587,659,784,659,587,784,880] : [262,330,392,330];
    let i = 0; const beat = fast ? 0.18 : 0.4;
    musicTimer = setInterval(() => {
      if (!musicOn) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime; o.type = fast ? 'square' : 'triangle';
      o.frequency.setValueAtTime(notes[i % notes.length], t);
      g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0, t + beat * 0.9);
      o.start(t); o.stop(t + beat); i++;
    }, beat * 1000);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function setMusic(on) { musicOn = on; if (!on) stopMusic(); }

  // ---------- Cena / render ----------
  function setupScene() {
    canvas = document.getElementById('game');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.011);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 700);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(60, 140, 40); scene.add(sun);
    resize(); window.addEventListener('resize', resize);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  let hemi, sun;

  // ---------- RNG com seed + ruido ----------
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  let rand = Math.random, SEED = 1, PARAMS = {};
  function noise2(x,z){ return Math.sin(x*0.12+SEED*0.001)*3 + Math.cos(z*0.12+SEED*0.002)*3 + Math.sin((x+z)*0.05)*2; }
  function H(x,z){ const amp = (PARAMS.mountainAmp||5); return Math.max(2, Math.floor(6 + noise2(x,z)/8*amp)); }

  // ---------- Mundo (blocos) ----------
  const geo = new THREE.BoxGeometry(1,1,1), matCache = {}, meshes = {}, lists = {};
  let world = new Map(); const key = (x,y,z) => x+','+y+','+z;
  let overrides = {}; // edicoes do jogador para salvar: key -> id|0(removido)
  function mat(id){ if(matCache[id]) return matCache[id]; const b=BLOCKS[id]; const m=new THREE.MeshStandardMaterial({color:b.v,transparent:!!b.liquid,opacity:b.liquid?0.7:1,emissive:b.light?new THREE.Color(b.v):0x000000,emissiveIntensity:b.light?0.9:0}); matCache[id]=[m,m,m,m,m,m]; return matCache[id]; }
  function setupMeshes(){ for(const id in BLOCKS){ meshes[id]=new THREE.InstancedMesh(geo,mat(id),120000); meshes[id].count=0; meshes[id].instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(meshes[id]); lists[id]=[]; } }
  const dummy = new THREE.Object3D();
  function rebuild(id){ const im=meshes[id],a=lists[id]; for(let i=0;i<a.length;i++){dummy.position.set(a[i].x,a[i].y,a[i].z);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);} im.count=a.length; im.instanceMatrix.needsUpdate=true; }
  function add(x,y,z,id,fromNet){ const q=key(x,y,z); if(world.has(q))return; world.set(q,id); lists[id].push({x,y,z}); rebuild(id); if(!fromNet&&!generating){ overrides[q]=id; net_block(x,y,z,id,'place'); } }
  function removeAt(x,y,z,fromNet){ const q=key(x,y,z); const id=world.get(q); if(id===undefined)return null; world.delete(q); const a=lists[id]; const i=a.findIndex(p=>p.x===x&&p.y===y&&p.z===z); if(i>=0){a.splice(i,1);rebuild(id);} if(!fromNet){ overrides[q]=0; net_block(x,y,z,0,'break'); } return id; }
  function blockAt(x,y,z){ return world.get(key(Math.floor(x),Math.floor(y),Math.floor(z))); }
  function solid(x,y,z){ const id=blockAt(x,y,z); return id!==undefined && !BLOCKS[id]?.liquid; }

  // ---------- Geracao do mundo ----------
  let generating=false; const chunksDone=new Set(); const R=14;
  function generateChunk(cx,cz){
    const ck=cx+','+cz; if(chunksDone.has(ck))return; chunksDone.add(ck); generating=true;
    const treeD=PARAMS.treeDensity||0.08, riverF=PARAMS.riverFreq||0.2, ore=PARAMS.oreRichness||0.06, sandy=PARAMS.sandiness||0.1;
    for(let x=cx*R;x<(cx+1)*R;x++){ for(let z=cz*R;z<(cz+1)*R;z++){
      let h=H(x,z); const river=(Math.sin(x*riverF)*Math.cos(z*riverF)>0.55); const surf=river?h-2:h;
      for(let y=0;y<=surf;y++){
        let id=2;
        if(y===0)id=13;
        else if(y===surf)id=river?7:(y<4?6:(rand()<sandy&&y<5?6:1));
        else if(y<surf-2)id=rand()<ore?8:(rand()<ore?10:3);
        const q=key(x,y,z); if(q in overrides){ const ov=overrides[q]; if(ov) add(x,y,z,ov,true); continue; }
        add(x,y,z,id,true);
      }
      if(!river&&surf>=6&&Math.abs(Math.sin(x*12.9+z*78.2))>(1-treeD)){
        for(let ty=1;ty<=4;ty++){const q=key(x,surf+ty,z); if(!(q in overrides))add(x,surf+ty,z,4,true);}
        for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)for(let oy=3;oy<=5;oy++){ if(ox||oz||oy===5){const q=key(x+ox,surf+oy,z+oz); if(!(q in overrides))add(x+ox,surf+oy,z+oz,5,true);} }
      }
    }}
    generating=false;
  }

  // ---------- Mobs: amigos, inimigos e larvas de lava ----------
  const mobs = [];
  function boxMesh(w,h,d,col){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color:col})); }
  function spawnMob(type,x,y,z){
    const g=new THREE.Group(); let col,hostile=false,larva=false;
    if(type==='zumbi'||type==='creeper'){ hostile=true; col=type==='creeper'?0x4caf50:0x3b5323;
      const body=boxMesh(0.6,1.0,0.35,col); body.position.y=0.9; g.add(body);
      const head=boxMesh(0.5,0.5,0.5,col); head.position.y=1.65; g.add(head);
      [[-0.2,0,0],[0.2,0,0]].forEach(p=>{const l=boxMesh(0.22,0.8,0.22,col);l.position.set(p[0],0.4,0);g.add(l);});
    } else if(type==='larva'){ larva=true; hostile=true; col=0xff5a1f;
      const body=boxMesh(0.5,0.5,1.2,col); body.position.y=0.3; g.add(body);
      const m=new THREE.PointLight(0xff6a2a,0.8,6); m.position.y=0.5; g.add(m);
    } else { col=type==='ovelha'?0xf0f0f0:0xffffff; const body=boxMesh(0.85,0.65,1.2,col); body.position.y=0.45; g.add(body);
      const head=boxMesh(0.45,0.45,0.55,col); head.position.set(0,0.8,0.7); g.add(head);
      [[-0.28,0,0.4],[0.28,0,0.4],[-0.28,0,-0.4],[0.28,0,-0.4]].forEach(p=>{const l=boxMesh(0.18,0.4,0.18,0x333);l.position.set(p[0],0.1,p[2]);g.add(l);});
    }
    g.position.set(x,y,z); scene.add(g);
    mobs.push({type,g,hostile,larva,hp:hostile?8:4,vx:(rand()-0.5)*2,vz:(rand()-0.5)*2,timer:0});
  }
  function updateMobs(dt){
    for(let i=mobs.length-1;i>=0;i--){ const m=mobs[i]; m.timer+=dt;
      const toP=new THREE.Vector3().subVectors(player.pos,m.g.position); const dist=toP.length();
      if(m.hostile && dist<18){ toP.y=0; toP.normalize(); const sp=m.larva?1.6:2.2; m.g.position.x+=toP.x*sp*dt; m.g.position.z+=toP.z*sp*dt; m.g.lookAt(player.pos.x,m.g.position.y,player.pos.z);
        if(dist<1.6){ player.hp=Math.max(0,player.hp-dt*(m.larva?8:5)); blip('hurt'); hud(); if(player.hp<=0) respawn(); }
      } else { if(m.timer>3){m.vx=(rand()-0.5)*2;m.vz=(rand()-0.5)*2;m.timer=0;} m.g.position.x+=m.vx*dt; m.g.position.z+=m.vz*dt; }
      m.g.position.y += (groundY(m.g.position.x,m.g.position.z)+0.0 - m.g.position.y)*Math.min(1,dt*6);
    }
  }
  function groundY(x,z){ for(let y=70;y>=-120;y--){ if(solid(Math.floor(x),y,Math.floor(z))) return y+1; } return 0; }

  // ---------- Jogador ----------
  const player = { pos:new THREE.Vector3(0,22,0), vel:new THREE.Vector3(), yaw:0, pitch:0, h:1.7, r:0.3, hp:20, onGround:false };
  const p2 = { enabled:false, pos:new THREE.Vector3(3,22,0), yaw:0, g:null };
  let inv = {1:50,2:40,3:40,4:20,5:30,6:30,8:5,9:2,10:15,11:8}; let selected=1;
  const hotbarIds=[1,2,3,4,6,8,11];
  const keys={};
  function keyToDir(code){ return ({KeyW:'f',ArrowUp:'f',KeyS:'b',ArrowDown:'b',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'})[code]; }

  function respawn(){ player.pos.set(0,22,0); player.vel.set(0,0,0); player.hp=20; hud(); }

  // ---------- Fisica + controles ----------
  function moveAxis(axis,amt){ const p=player.pos,r=player.r; p[axis]+=amt;
    const feet=p.y-player.h, head=p.y-0.1;
    for(let y=Math.floor(feet);y<=Math.floor(head);y++)for(let x=Math.floor(p.x-r);x<=Math.floor(p.x+r);x++)for(let z=Math.floor(p.z-r);z<=Math.floor(p.z+r);z++){
      if(solid(x,y,z)){ if(axis==='x')p.x=amt>0?x-r-0.01:x+1+r+0.01; else if(axis==='z')p.z=amt>0?z-r-0.01:z+1+r+0.01; else{ if(amt<0){p.y=y+1+player.h+0.01;player.vel.y=0;player.onGround=true;}else{p.y=y-0.11;player.vel.y=0;} } return; }
    }
  }
  function physics(dt){
    const sp=keys.ShiftLeft?7:4.6;
    const f=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
    const r=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
    const m=new THREE.Vector3();
    const d={}; for(const c in keys){ if(keys[c]){const dir=keyToDir(c); if(dir)d[dir]=1;} }
    if(d.f)m.add(f); if(d.b)m.sub(f); if(d.r)m.add(r); if(d.l)m.sub(r);
    const moving=m.lengthSq()>0; if(moving)m.normalize().multiplyScalar(sp*dt);
    player.onGround=false; player.vel.y-=22*dt;
    moveAxis('x',m.x); moveAxis('z',m.z); moveAxis('y',player.vel.y*dt);
    if(keys.Space&&player.onGround){player.vel.y=8;player.onGround=false;}
    if(moving&&player.onGround){ footTimer-=dt; if(footTimer<=0){blip('step');footTimer=0.32;} }
    camera.position.copy(player.pos); camera.position.y+=0.05;
    camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
    // co-op local jogador 2 (I J K L)
    if(p2.enabled){ const s=4*dt; if(keys.KeyI)p2.pos.z-=s; if(keys.KeyK)p2.pos.z+=s; if(keys.KeyJ)p2.pos.x-=s; if(keys.KeyL)p2.pos.x+=s; p2.pos.y=groundY(p2.pos.x,p2.pos.z)+1; if(p2.g)p2.g.position.copy(p2.pos); }
    const cx=Math.floor(player.pos.x/R),cz=Math.floor(player.pos.z/R);
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)generateChunk(cx+x,cz+z);
    updateMobs(dt); updateDayNight(); net_pos();
  }

  // ---------- Raycast: quebrar / colocar ----------
  function rayVoxel(place){
    const dir=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
    const o=camera.position.clone(); let last=null;
    for(let t=0;t<6;t+=0.05){ const p=o.clone().add(dir.clone().multiplyScalar(t)); const bx=Math.floor(p.x),by=Math.floor(p.y),bz=Math.floor(p.z);
      if(solid(bx,by,bz)||blockAt(bx,by,bz)!==undefined){ return place?last:{x:bx,y:by,z:bz}; } last={x:bx,y:by,z:bz}; }
    return place?last:null;
  }
  function doBreak(){ const h=rayVoxel(false); if(!h)return; const id=removeAt(h.x,h.y,h.z); if(id){ blip('break'); if(inv[id]!==undefined)inv[id]++; stats.blocks_broken++; renderHotbar(); } }
  function doPlace(){ const h=rayVoxel(true); if(!h)return; const id=selected; if((inv[id]||0)<=0)return; add(h.x,h.y,h.z,id); blip(id===11?'torch':'place'); inv[id]--; stats.blocks_placed++; if(id===5)stats.wood_used++; if(id===3)stats.stone_used++; renderHotbar(); }
  function placeTorch(){ const h=rayVoxel(true); if(!h)return; if((inv[11]||0)<=0){toast('Sem tochas!');return;} add(h.x,h.y,h.z,11); const l=new THREE.PointLight(0xffcc66,1.1,9); l.position.set(h.x+0.5,h.y+0.5,h.z+0.5); scene.add(l); blip('torch'); inv[11]--; stats.torches_used++; renderHotbar(); }

  // ---------- Tunel ate o centro da Terra (com larvas de lava) ----------
  function digTunnel(){ blip('dig'); const bx=Math.floor(player.pos.x), bz=Math.floor(player.pos.z); const by=Math.floor(player.pos.y-player.h-0.1);
    for(let dy=0;dy<3;dy++){ removeAt(bx,by-dy,bz); } player.pos.y-=2.2; player.vel.y=0; stats.depth_reached=Math.max(stats.depth_reached,Math.round(60-player.pos.y));
    // perto do centro: rocha profunda, nucleo quente e larvas de lava
    if(player.pos.y<-40){ for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){ const q=key(bx+x,Math.floor(player.pos.y)-3,bz+z); if(!world.has(q))add(bx+x,Math.floor(player.pos.y)-3,bz+z,13); }
      if(rand()<0.5) spawnMob('larva',bx+(rand()-0.5)*4,player.pos.y,bz+(rand()-0.5)*4);
    }
    if(player.pos.y<-80){ add(bx,Math.floor(player.pos.y)-2,bz,14); for(let i=0;i<3;i++)spawnMob('larva',bx+(rand()-0.5)*6,player.pos.y,bz+(rand()-0.5)*6); toast('Voce chegou ao centro da Terra!'); }
  }

  // ---------- Dia e noite pelo horario LOCAL do pais ----------
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function updateDayNight(){
    const now=new Date(); const hours=now.getHours()+now.getMinutes()/60; // horario local do dispositivo
    const dayFrac=hours/24; const sunAngle=(dayFrac*Math.PI*2)-Math.PI/2;
    const sy=Math.sin(sunAngle), sx=Math.cos(sunAngle);
    sun.position.set(sx*120, Math.max(-30,sy*140), 60);
    const light=Math.max(0, sy); // 0 a noite, 1 ao meio-dia
    sun.intensity=0.15+light*1.0; hemi.intensity=0.25+light*0.6;
    // cor do ceu: azul de dia, laranja no por do sol, escuro a noite
    const day=new THREE.Color(0x87ceeb), dusk=new THREE.Color(0xff8c42), night=new THREE.Color(0x0b1430);
    let col; if(light>0.25){col=day.clone().lerp(dusk,1-Math.min(1,(light-0.25)/0.5));} else if(light>0){col=dusk.clone().lerp(night,1-light/0.25);} else {col=night;}
    scene.background.copy(col); scene.fog.color.copy(col);
    if(clockEl){ const hh=String(now.getHours()).padStart(2,'0'), mm=String(now.getMinutes()).padStart(2,'0'); clockEl.textContent=(light>0.08?'☀️':'🌙')+' '+hh+':'+mm+' · '+tz; }
  }

  // ---------- HUD ----------
  let clockEl;
  function hud(){ const h=document.getElementById('hud'); if(h)h.innerHTML=`<b>${opts.character?opts.character.name:''}</b> · ${opts.character?opts.character.tool:''}<br>Vida: ${Math.round(player.hp)}/20<br>Mundo: ${opts.worldName||'—'}<br>Modo: ${opts.mode}`; }
  function renderHotbar(){ const hb=document.getElementById('hotbar'); if(!hb)return; hb.innerHTML=''; hotbarIds.forEach((id,i)=>{ const d=document.createElement('div'); d.className='slot'+(selected===id?' active':''); d.innerHTML=`<div class="sw" style="background:${BLOCKS[id].c}"></div>${BLOCKS[id].n}<span class="cnt">${inv[id]||0}</span>`; d.onclick=()=>{selected=id;renderHotbar();}; hb.appendChild(d); }); }
  function toast(msg){ const t=document.getElementById('toast'); if(!t)return; t.textContent=msg; t.style.opacity=1; clearTimeout(t._h); t._h=setTimeout(()=>t.style.opacity=0,2200); }

  // ---------- Estatisticas (alimentam o diretor de cenarios no servidor) ----------
  const stats = { blocks_broken:0, blocks_placed:0, depth_reached:0, water_used:0, wood_used:0, stone_used:0, torches_used:0 };
  let statsTimer=0;
  function flushStats(){ if(!Net.getToken())return; Net.sendStats({...stats}).catch(()=>{}); }

  // ---------- Multiplayer: jogadores remotos ----------
  const remote = {}; // peerId -> {g, pos}
  function remoteAvatar(name,characterId){ const c=(window.CHARACTERS.find(x=>x.id===characterId)||CHARACTERS[0]).color; const g=new THREE.Group(); const body=boxMesh(0.6,1.1,0.35,c); body.position.y=0.95; g.add(body); const head=boxMesh(0.5,0.5,0.5,c); head.position.y=1.7; g.add(head); scene.add(g); return g; }
  let posTimer=0;
  function net_pos(){ if(!wsOn)return; posTimer-=0.016; if(posTimer>0)return; posTimer=0.08; Net.wsSend({t:'pos',pos:{x:player.pos.x,y:player.pos.y,z:player.pos.z},yaw:player.yaw}); }
  function net_block(x,y,z,id,op){ if(!wsOn)return; Net.wsSend({t:'block',x,y,z,id,op}); }
  let wsOn=false;

  async function startMultiplayer(room){
    try{
      await Net.connectWS(room);
      wsOn=true;
      Net.on('peer-join',m=>{ if(!remote[m.peerId])remote[m.peerId]={g:remoteAvatar(m.name,m.character)}; if(Voice.isEnabled())Voice.connectTo(m.peerId); });
      Net.on('pos',m=>{ let r=remote[m.peerId]; if(!r){r=remote[m.peerId]={g:remoteAvatar('?',1)};} r.g.position.set(m.pos.x,m.pos.y-1.6,m.pos.z); r.g.rotation.y=m.yaw||0; });
      Net.on('block',m=>{ if(m.op==='break')removeAt(m.x,m.y,m.z,true); else add(m.x,m.y,m.z,m.id,true); });
      Net.on('peer-left',m=>{ if(remote[m.peerId]){scene.remove(remote[m.peerId].g);delete remote[m.peerId];} Voice.drop(m.peerId); });
      Net.on('chat',m=>pushChat(m.name,m.m));
      Net.on('gift',m=>toast(`🎁 ${m.name} pegou um presente (${m.kind})${m.from?' de outro jogador':''}`));
      Net.on('rtc-offer',m=>Voice.onOffer(m.from,m.sdp));
      Net.on('rtc-answer',m=>Voice.onAnswer(m.from,m.sdp));
      Net.on('rtc-ice',m=>Voice.onIce(m.from,m.cand));
    }catch(e){ toast('Online indisponivel: '+e.message); }
  }

  // ---------- Chat ----------
  function pushChat(who,msg){ const log=document.getElementById('chatlog'); if(!log)return; const d=document.createElement('div'); d.className='msg'; d.innerHTML=`<span class="who">${who}:</span> ${String(msg).replace(/[<>]/g,'')}`; log.appendChild(d); log.scrollTop=log.scrollHeight; }
  function sendChat(msg){ if(wsOn)Net.wsSend({t:'chat',m:msg}); pushChat('voce',msg); }

  // ---------- Evento (presentes) ----------
  let eventActive=false;
  function setEvent(active){ if(active===eventActive)return; eventActive=active; if(active){ toast('🎉 Evento comecou! Pegue presentes!'); startMusic(true); spawnGifts(); } else { toast('Evento encerrado — de volta ao seu mundo'); if(musicOn)startMusic(false); } }
  const giftMeshes=[];
  function spawnGifts(){ for(let i=0;i<8;i++){ const g=boxMesh(0.6,0.6,0.6,0xff3b6b); g.position.set((rand()-0.5)*30, groundY((rand()-0.5)*30,(rand()-0.5)*30)+0.5, (rand()-0.5)*30); scene.add(g); giftMeshes.push(g); } }
  function checkGiftPickup(){ for(let i=giftMeshes.length-1;i>=0;i--){ if(player.pos.distanceTo(giftMeshes[i].position)<1.6){ scene.remove(giftMeshes[i]); giftMeshes.splice(i,1); blip('gift'); Net.collectGift().then(r=>toast('🎁 Presente: '+r.kind)).catch(()=>{}); if(wsOn)Net.wsSend({t:'gift',kind:'presente'}); } } }

  // ---------- Entradas ----------
  function bindInput(){
    addEventListener('keydown',e=>{ if(e.target&&e.target.tagName==='INPUT')return; keys[e.code]=true;
      if(e.code==='KeyT')placeTorch(); if(e.code==='KeyF')digTunnel(); if(e.code==='KeyM')api_save();
      if(/^Digit[1-7]$/.test(e.code)){ selected=hotbarIds[+e.code.slice(5)-1]||selected; renderHotbar(); }
      if(e.code==='Enter'){ const inp=document.getElementById('chatin'); if(inp.style.display==='block'){ if(inp.value.trim())sendChat(inp.value.trim()); inp.value=''; inp.style.display='none'; inp.blur(); } else { inp.style.display='block'; inp.focus(); } }
    });
    addEventListener('keyup',e=>keys[e.code]=false);
    canvas.addEventListener('mousedown',e=>{ if(!running)return; if(document.pointerLockElement!==canvas){canvas.requestPointerLock();return;} if(e.button===0)doBreak(); else if(e.button===2)doPlace(); });
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('mousemove',e=>{ if(document.pointerLockElement!==canvas)return; player.yaw-=e.movementX*0.002; player.pitch=Math.max(-1.5,Math.min(1.5,player.pitch-e.movementY*0.002)); });
    // touch
    document.querySelectorAll('#touch button').forEach(b=>{ const k=b.dataset.k; const map={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',jump:'Space'}; const press=on=>{ if(k==='break'){if(on)doBreak();} else if(k==='place'){if(on)doPlace();} else keys[map[k]]=on; }; b.addEventListener('touchstart',e=>{e.preventDefault();press(true);}); b.addEventListener('touchend',e=>{e.preventDefault();press(false);}); });
  }

  // ---------- Salvar mundo no banco ----------
  async function api_save(){ if(!Net.getToken()){toast('Entre numa conta para salvar');return;} try{ const payload={ id:opts.worldId||undefined, name:opts.worldName||'Mundo', seed:SEED, is_shared:false, data:{ overrides, player:{x:player.pos.x,y:player.pos.y,z:player.pos.z}, params:PARAMS } }; const r=await Net.saveWorld(payload); opts.worldId=r.world.id; toast('💾 Mundo salvo!'); }catch(e){ toast('Erro ao salvar: '+e.message); } }

  // ---------- Loop ----------
  let last=performance.now();
  function loop(now){ requestAnimationFrame(loop); const dt=Math.min(0.04,(now-last)/1000); last=now; if(running){ physics(dt); checkGiftPickup(); statsTimer+=dt; if(statsTimer>20){statsTimer=0;flushStats();} } renderer.render(scene,camera); }

  // ---------- Polling do evento ----------
  function pollEvent(){ Net.event().then(s=>{ setEvent(!!s.active); }).catch(()=>{}); setTimeout(pollEvent,15000); }

  // ---------- Inicializacao publica ----------
  function init(o){
    opts=o||{}; THREE=window.THREE; initAudio(); setMusic(opts.music!==false);
    if(!scene){ setupScene(); setupMeshes(); bindInput(); requestAnimationFrame(loop); }
    // seed e parametros do cenario (do diretor/IA ou do mundo salvo)
    SEED=(opts.seed|0)||((Math.random()*2e9)|0); rand=mulberry32(SEED); PARAMS=opts.params||{};
    world.clear(); chunksDone.clear(); for(const id in lists){lists[id].length=0;rebuild(id);} overrides=opts.overrides||{};
    // mundo inicial
    const cx=0,cz=0; for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)generateChunk(cx+x,cz+z);
    player.pos.set(0,22,0); player.hp=20; player.yaw=0; player.pitch=0;
    // mobs iniciais: amigos + inimigos (como no Minecraft)
    for(let i=0;i<3;i++)spawnMob(i%2?'ovelha':'galinha',(rand()-0.5)*24,20,(rand()-0.5)*24);
    for(let i=0;i<4;i++)spawnMob(rand()<0.5?'zumbi':'creeper',(rand()-0.5)*30,20,(rand()-0.5)*30);
    // co-op local
    p2.enabled=opts.mode==='local'; if(p2.enabled&&!p2.g){ p2.g=remoteAvatar('P2',opts.p2char||2); }
    // UI de jogo
    clockEl=document.getElementById('clock');
    ['#cross','#hud','#hud2','#clock','#hotbar','#chatbox','#peers'].forEach(s=>{const el=document.querySelector(s); if(el)el.style.display= (s==='#chatbox'||s==='#peers')? (opts.mode==='online'||opts.mode==='invite'?'block':'none') : (s==='#hotbar'?'flex':'block');});
    hud(); renderHotbar(); updateDayNight();
    running=true; canvas.requestPointerLock();
    if(opts.mode==='online'||opts.mode==='invite'){ startMultiplayer(opts.room||'global'); }
    pollEvent();
  }
  function stop(){ running=false; wsOn=false; Net.disconnectWS(); document.exitPointerLock&&document.exitPointerLock(); }

  return { init, stop, setMusic, startMusic, stopMusic, giveGift:(kind,n)=>{ /* usar presente ganho jogando sozinho */ const map={ferro:8,madeira:4,pedra:3,agua:7,areia:6,tocha:11,diamante:9}; const id=map[kind]; if(id!==undefined){inv[id]=(inv[id]||0)+(n||1);renderHotbar();toast('Usou presente: '+kind);} } };
})();
