// ============================================================
// STATE
// ============================================================
const STATE = {
    sessions: [],
    streak: 0,
    currentRating: 0,
    timerInterval: null,
    timerSeconds: 120,
    timerTotal: 120,
    timerRunning: false,
    sessionCount: 0,
    drillsDone: new Set(),
    paletteColors: [],
    mixerTarget: {r:0,g:0,b:0},
    valueTargets: [],
    perspVP: [{x:200,y:0},{x:560,y:0}],
    perspDragging: -1,
    perspDrawing: false,
    perspLastX: 0,
    perspLastY: 0,
  };
  
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  function loadState() {
    try {
      const s = localStorage.getItem('atelier_state');
      if (s) {
        const loaded = JSON.parse(s);
        STATE.sessions = loaded.sessions || [];
        STATE.streak = loaded.streak || 0;
      }
    } catch(e){}
  }
  
  function saveStateLS() {
    try {
      localStorage.setItem('atelier_state', JSON.stringify({sessions: STATE.sessions, streak: STATE.streak}));
    } catch(e){}
  }
  
  // ============================================================
  // NAVIGATION
  // ============================================================
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    const btns = document.querySelectorAll('.nav-item');
    btns.forEach(b => { 
      if (b.textContent.trim().toLowerCase().includes(id) || (id==='dashboard' && b.textContent.includes('Dashboard'))) 
        b.classList.add('active'); 
    });
    if (id === 'perspective') { setTimeout(initPerspCanvas, 50); }
    if (id === 'drills') renderDrills();
  }
  
  // ============================================================
  // CHALLENGES
  // ============================================================
  const CHALLENGES = [
    "Draw 5 hands in different poses — focus on foreshortening.",
    "Sketch 3 faces: front view, 3/4 view, and profile.",
    "Draw a simple still life with one light source — focus on shadows.",
    "Complete 10 × 30-second gesture drawings of figures.",
    "Draw the same object from 3 different angles.",
    "Practice 20 straight lines freehand — aim for accuracy.",
    "Sketch a city block in 2-point perspective.",
    "Create a 5-step value scale and shade a sphere.",
    "Draw 5 different feet from observation or reference.",
    "Design a color palette inspired by a sunset.",
    "Fill a page with ellipses of different sizes and angles.",
    "Sketch 5 different hands gripping various objects.",
    "Draw a room interior in 1-point perspective.",
    "Practice hatching: 4 different directions at 3 pressures.",
    "Draw 3 animals in simple gesture strokes.",
  ];
  
  function newChallenge() {
    const el = document.getElementById('daily-challenge');
    const current = el.textContent;
    let next;
    do { next = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]; } while (next === current);
    el.textContent = next;
  }
  
  // ============================================================
  // HEATMAP
  // ============================================================
  function buildHeatmap() {
    const hm = document.getElementById('heatmap');
    hm.innerHTML = '';
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const cell = document.createElement('div');
      cell.className = 'hm-cell';
      const sCount = STATE.sessions.filter(s => s.date === key).length;
      if (sCount === 1) cell.classList.add('l2');
      else if (sCount === 2) cell.classList.add('l3');
      else if (sCount >= 3) cell.classList.add('l4');
      cell.title = key;
      hm.appendChild(cell);
    }
  }
  
  // ============================================================
  // BADGES
  // ============================================================
  const BADGES = [
    { id:'first', label:'First Session', check: s => s.length >= 1 },
    { id:'week', label:'7-Day Streak', check: (s,streak) => streak >= 7 },
    { id:'g10', label:'10 Sessions', check: s => s.length >= 10 },
    { id:'g50', label:'50 Sessions', check: s => s.length >= 50 },
    { id:'h10', label:'10 Hours', check: s => s.reduce((a,b)=>a+(b.duration||0),0) >= 600 },
    { id:'color', label:'Color Mixer', check: s => s.some(x => x.skills && x.skills.includes('Color')) },
    { id:'persp', label:'Perspective', check: s => s.some(x => x.skills && x.skills.includes('Perspective')) },
  ];
  
  function buildBadges() {
    const bg = document.getElementById('badge-grid');
    bg.innerHTML = '';
    BADGES.forEach(b => {
      const earned = b.check(STATE.sessions, STATE.streak);
      const el = document.createElement('div');
      el.className = 'badge-item' + (earned ? ' earned' : '');
      el.innerHTML = `<span class="bi">${earned ? '★' : '○'}</span> ${b.label}`;
      bg.appendChild(el);
    });
  }
  
  // ============================================================
  // DASHBOARD STATS
  // ============================================================
  function updateDashboard() {
    const sessions = STATE.sessions;
    document.getElementById('stat-sessions').textContent = sessions.length;
    const totalMin = sessions.reduce((a,b) => a + (b.duration||0), 0);
    document.getElementById('stat-hours').textContent = (totalMin/60).toFixed(1);
    const streak = calcStreak();
    STATE.streak = streak;
    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('sidebar-streak').textContent = streak;
    const ratings = sessions.filter(s => s.rating).map(s => s.rating);
    document.getElementById('stat-rating').textContent = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—';
    buildHeatmap();
    buildBadges();
  }
  
  function calcStreak() {
    if (!STATE.sessions.length) return 0;
    const today = new Date().toISOString().slice(0,10);
    const dates = [...new Set(STATE.sessions.map(s => s.date))].sort().reverse();
    let streak = 0;
    let cur = new Date(today);
    for (const d of dates) {
      const check = cur.toISOString().slice(0,10);
      if (d === check) { streak++; cur.setDate(cur.getDate()-1); }
      else break;
    }
    return streak;
  }
  
  // ============================================================
  // TIMER
  // ============================================================
  const PROMPTS = [
    "Standing figure, weight on right leg","Seated figure, arms crossed",
    "Reclining figure, head resting on hand","Running pose — mid-stride",
    "Figure reaching overhead","Crouching figure","Jumping — both feet off ground",
    "Pushing against a wall","Kicking motion","Figure carrying a heavy object",
    "Person looking over their shoulder","Sitting cross-legged",
    "Standing with hands on hips","Figure leaning forward",
    "Dynamic twist at the torso","Hand open, palm facing viewer",
    "Fist, 3/4 view","Hand pointing","Cupped hands","Hand gripping a cylinder",
    "Foot — top view","Foot — side profile","Eye — front view","Ear — side view",
    "Nose — 3/4 view","Simple apple","Coffee mug","Chair — 3/4 view",
    "Bicycle wheel","Open book","Shoe","Crumpled paper bag",
    "Tree silhouette","Simple face — 3/4 view","Hands praying",
  ];
  
  let timerSecs = 120, timerTotal = 120, timerRunning = false, timerIv = null, poseCount = 0;
  
  function setPreset(s) {
    timerSecs = s; timerTotal = s;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    updateTimerDisplay();
    if (timerRunning) { clearInterval(timerIv); timerRunning = false; document.getElementById('timer-start-btn').textContent = '▶ Start'; }
  }
  
  function setCustomTime() {
    const v = prompt('Enter seconds:', '120');
    if (v && !isNaN(v) && parseInt(v) > 0) { setPreset(parseInt(v)); }
  }
  
  function updateTimerDisplay() {
    const m = Math.floor(timerSecs / 60);
    const s = timerSecs % 60;
    document.getElementById('timer-display').textContent = m + ':' + String(s).padStart(2,'0');
    const circ = 2 * Math.PI * 100;
    const offset = circ * (1 - timerSecs / timerTotal);
    document.getElementById('timer-arc').style.strokeDashoffset = offset;
  }
  
  function timerToggle() {
    if (timerRunning) {
      clearInterval(timerIv); timerRunning = false;
      document.getElementById('timer-start-btn').textContent = '▶ Start';
      document.getElementById('timer-status').textContent = 'Paused';
    } else {
      timerRunning = true;
      document.getElementById('timer-start-btn').textContent = '⏸ Pause';
      document.getElementById('timer-status').textContent = 'Drawing…';
      timerIv = setInterval(() => {
        timerSecs--;
        updateTimerDisplay();
        if (timerSecs <= 0) {
          clearInterval(timerIv); timerRunning = false;
          document.getElementById('timer-start-btn').textContent = '▶ Start';
          document.getElementById('timer-status').textContent = 'Done!';
          poseCount++;
          document.getElementById('session-count').textContent = poseCount;
          nextPrompt();
          timerSecs = timerTotal;
          updateTimerDisplay();
          if (typeof AudioContext !== 'undefined') {
            try {
              const ac = new AudioContext();
              const osc = ac.createOscillator();
              const gain = ac.createGain();
              osc.connect(gain); gain.connect(ac.destination);
              osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ac.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
              osc.start(); osc.stop(ac.currentTime + 0.4);
            } catch(e){}
          }
        }
      }, 1000);
    }
  }
  
  function timerReset() {
    clearInterval(timerIv); timerRunning = false;
    timerSecs = timerTotal;
    updateTimerDisplay();
    document.getElementById('timer-start-btn').textContent = '▶ Start';
    document.getElementById('timer-status').textContent = 'Ready';
  }
  
  function nextPrompt() {
    const arr = PROMPTS;
    document.getElementById('current-prompt').textContent = arr[Math.floor(Math.random() * arr.length)];
  }
  
  // ============================================================
  // DRILLS
  // ============================================================
  const DRILLS = [
    { id:'lines', name:'Straight Lines', desc:'Draw parallel horizontal and vertical lines across the canvas.' },
    { id:'circles', name:'Circles', desc:'Fill the canvas with circles of various sizes — freehand only.' },
    { id:'ellipses', name:'Ellipses', desc:'Draw ellipses at different angles and foreshortening.' },
    { id:'hatching', name:'Hatching', desc:'Practice hatching in 4 directions: 0°, 45°, 90°, 135°.' },
    { id:'boxes', name:'Perspective Boxes', desc:'Draw 5 boxes in 2-point perspective from memory.' },
  ];
  
  const drillCanvases = {};
  const drillCtx = {};
  const drillDrawing = {};
  
  function renderDrills() {
    const cont = document.getElementById('drills-container');
    cont.innerHTML = '';
    DRILLS.forEach(d => {
      const card = document.createElement('div');
      card.className = 'drill-card' + (STATE.drillsDone.has(d.id) ? ' done' : '');
      card.id = 'drill-' + d.id;
      card.innerHTML = `
        <div class="drill-name">${d.name} ${STATE.drillsDone.has(d.id) ? '<span class="check-mark">✓ Done</span>' : ''}</div>
        <div class="drill-desc">${d.desc}</div>
        <canvas class="drill-canvas" id="dc-${d.id}" height="120"></canvas>
        <div class="drill-actions">
          <button class="btn btn-secondary btn-sm" onclick="clearDrill('${d.id}')">Clear</button>
          <button class="btn btn-primary btn-sm" onclick="markDone('${d.id}')">Mark Complete ✓</button>
        </div>`;
      cont.appendChild(card);
      setTimeout(() => initDrillCanvas(d.id), 10);
    });
  }
  
  function initDrillCanvas(id) {
    const c = document.getElementById('dc-' + id);
    if (!c) return;
    c.width = c.offsetWidth || 300;
    drillCanvases[id] = c;
    drillCtx[id] = c.getContext('2d');
    drillCtx[id].fillStyle = '#fff';
    drillCtx[id].fillRect(0,0,c.width,c.height);
    drillDrawing[id] = false;
    c.addEventListener('mousedown', e => { drillDrawing[id]=true; const p=getPos(c,e); drillCtx[id].beginPath(); drillCtx[id].moveTo(p.x,p.y); });
    c.addEventListener('mousemove', e => { if(!drillDrawing[id]) return; const p=getPos(c,e); drillCtx[id].strokeStyle='#222'; drillCtx[id].lineWidth=1.5; drillCtx[id].lineCap='round'; drillCtx[id].lineTo(p.x,p.y); drillCtx[id].stroke(); });
    c.addEventListener('mouseup', () => drillDrawing[id]=false);
    c.addEventListener('mouseleave', () => drillDrawing[id]=false);
    c.addEventListener('touchstart', e => { e.preventDefault(); drillDrawing[id]=true; const p=getPos(c,e.touches[0]); drillCtx[id].beginPath(); drillCtx[id].moveTo(p.x,p.y); });
    c.addEventListener('touchmove', e => { e.preventDefault(); if(!drillDrawing[id]) return; const p=getPos(c,e.touches[0]); drillCtx[id].strokeStyle='#222'; drillCtx[id].lineWidth=1.5; drillCtx[id].lineCap='round'; drillCtx[id].lineTo(p.x,p.y); drillCtx[id].stroke(); });
    c.addEventListener('touchend', () => drillDrawing[id]=false);
  }
  
  function getPos(canvas, e) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }
  
  function clearDrill(id) {
    const c = drillCanvases[id]; if(!c) return;
    drillCtx[id].fillStyle = '#fff';
    drillCtx[id].fillRect(0,0,c.width,c.height);
  }
  
  function markDone(id) {
    STATE.drillsDone.add(id);
    renderDrills();
  }
  
  // ============================================================
  // PERSPECTIVE GRID
  // ============================================================
  let perspCanvas, perspCtx, perspUserCtx, perspUserCanvas;
  let vps = [], perspDrawingMode = false, perspLastX=0, perspLastY=0;
  let vpDragging = -1, perspInitialized = false;
  
  function getPerspMode() {
    return parseInt(document.getElementById('persp-mode').value, 10);
  }
  
  function getHorizonY(h) {
    return h * (parseInt(document.getElementById('horizon-slider').value, 10) / 100);
  }
  
  function initVPsForMode(mode, w, h, hy, prev) {
    if (mode === 1) {
      const x = prev && prev[0] ? prev[0].x : w / 2;
      return [{ x, y: hy }];
    }
    if (mode === 2) {
      const x0 = prev && prev[0] ? prev[0].x : w * 0.2;
      const x1 = prev && prev[1] ? prev[1].x : w * 0.8;
      return [{ x: x0, y: hy }, { x: x1, y: hy }];
    }
    const x0 = prev && prev[0] ? prev[0].x : w * 0.2;
    const x1 = prev && prev[1] ? prev[1].x : w * 0.8;
    const x2 = prev && prev[2] ? prev[2].x : w / 2;
    const y2 = prev && prev[2] ? prev[2].y : hy - h * 0.35;
    return [{ x: x0, y: hy }, { x: x1, y: hy }, { x: x2, y: y2 }];
  }
  
  function ensureVPsForMode(mode, w, h, hy) {
    const count = mode === 1 ? 1 : mode === 2 ? 2 : 3;
    if (vps.length !== count) vps = initVPsForMode(mode, w, h, hy, vps);
    if (mode === 1) vps[0].y = hy;
    else {
      vps[0].y = hy;
      vps[1].y = hy;
    }
  }
  
  function ensurePerspUserCanvas() {
    if (!perspCanvas) return;
    const w = perspCanvas.width, h = perspCanvas.height;
    if (!perspUserCanvas) {
      perspUserCanvas = document.createElement('canvas');
      perspUserCtx = perspUserCanvas.getContext('2d');
    }
    if (perspUserCanvas.width !== w || perspUserCanvas.height !== h) {
      perspUserCanvas.width = w;
      perspUserCanvas.height = h;
    }
  }
  
  function onPerspModeChange() {
    if (!perspCanvas) return;
    const w = perspCanvas.width, h = perspCanvas.height;
    vps = initVPsForMode(getPerspMode(), w, h, getHorizonY(h), vps);
    drawGrid();
  }
  
  function initPerspCanvas() {
    perspCanvas = document.getElementById('perspective-canvas');
    if (!perspCanvas) return;
    const w = perspCanvas.offsetWidth || 700;
    perspCanvas.width = w;
    const h = perspCanvas.height;
    perspCtx = perspCanvas.getContext('2d');
    ensurePerspUserCanvas();
    vps = initVPsForMode(getPerspMode(), w, h, getHorizonY(h), vps);
  
    if (!perspInitialized) {
      perspCanvas.addEventListener('mousedown', perspMD);
      perspCanvas.addEventListener('mousemove', perspMM);
      perspCanvas.addEventListener('mouseup', perspMU);
      perspCanvas.addEventListener('touchstart', e => { e.preventDefault(); perspMD(e.touches[0]); });
      perspCanvas.addEventListener('touchmove', e => { e.preventDefault(); perspMM(e.touches[0]); });
      perspCanvas.addEventListener('touchend', perspMU);
      perspInitialized = true;
    }
    drawGrid();
  }
  
  function perspMD(e) {
    const p = getPos(perspCanvas, e);
    vpDragging = -1;
    for (let i = 0; i < vps.length; i++) {
      if (Math.hypot(p.x - vps[i].x, p.y - vps[i].y) < 14) { vpDragging = i; return; }
    }
    perspDrawingMode = true;
    perspLastX = p.x; perspLastY = p.y;
  }
  
  function perspMM(e) {
    const p = getPos(perspCanvas, e);
    if (vpDragging >= 0) {
      const mode = getPerspMode();
      const hy = getHorizonY(perspCanvas.height);
      if (mode === 3 && vpDragging === 2) {
        vps[2].x = p.x;
        vps[2].y = p.y;
      } else {
        vps[vpDragging].x = p.x;
        vps[vpDragging].y = hy;
      }
      drawGrid();
      return;
    }
    if (perspDrawingMode && perspUserCtx) {
      perspUserCtx.strokeStyle = '#000';
      perspUserCtx.lineWidth = 1.5;
      perspUserCtx.lineCap = 'round';
      perspUserCtx.beginPath();
      perspUserCtx.moveTo(perspLastX, perspLastY);
      perspUserCtx.lineTo(p.x, p.y);
      perspUserCtx.stroke();
      perspLastX = p.x; perspLastY = p.y;
      drawGrid();
    }
  }
  
  function perspMU() { vpDragging = -1; perspDrawingMode = false; }
  
  function drawHorizonGridLines(ctx, vp, w, h) {
    for (let i = 0; i <= 20; i++) {
      const tx = (i / 20) * w;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(tx, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(tx, h);
      ctx.stroke();
    }
  }
  
  function drawVerticalGridLines(ctx, vp, w, h) {
    for (let i = 0; i <= 20; i++) {
      const tx = (i / 20) * w;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(tx, h);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const ty = (i / 10) * h;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(0, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(w, ty);
      ctx.stroke();
    }
  }
  
  function drawGrid() {
    if (!perspCanvas || !perspCtx) return;
    const mode = getPerspMode();
    const opacity = parseInt(document.getElementById('opacity-slider').value, 10) / 100;
    const w = perspCanvas.width, h = perspCanvas.height;
    const hy = getHorizonY(h);
  
    ensureVPsForMode(mode, w, h, hy);
    ensurePerspUserCanvas();
  
    perspCtx.clearRect(0, 0, w, h);
    perspCtx.fillStyle = '#f8f6f2';
    perspCtx.fillRect(0, 0, w, h);
  
    perspCtx.save();
    perspCtx.globalAlpha = opacity;
    perspCtx.strokeStyle = '#c0a87c';
    perspCtx.lineWidth = 1.2;
    perspCtx.beginPath();
    perspCtx.moveTo(0, hy);
    perspCtx.lineTo(w, hy);
    perspCtx.stroke();
  
    perspCtx.strokeStyle = 'rgba(74,127,193,0.6)';
    perspCtx.lineWidth = 0.5;
  
    const activeVps = mode === 1 ? vps.slice(0, 1) : mode === 2 ? vps.slice(0, 2) : vps;
    activeVps.forEach((vp, i) => {
      if (mode === 3 && i === 2) drawVerticalGridLines(perspCtx, vp, w, h);
      else drawHorizonGridLines(perspCtx, vp, w, h);
    });
  
    perspCtx.restore();
  
    activeVps.forEach(vp => {
      perspCtx.beginPath();
      perspCtx.arc(vp.x, vp.y, 7, 0, Math.PI * 2);
      perspCtx.fillStyle = '#E8651A';
      perspCtx.fill();
      perspCtx.strokeStyle = '#fff';
      perspCtx.lineWidth = 1.5;
      perspCtx.stroke();
    });
  
    if (perspUserCanvas) perspCtx.drawImage(perspUserCanvas, 0, 0);
  }
  
  function clearPerspCanvas() {
    ensurePerspUserCanvas();
    if (!perspUserCtx) return;
    perspUserCtx.clearRect(0, 0, perspUserCanvas.width, perspUserCanvas.height);
    drawGrid();
  }
  
  function exportGrid() {
    if (!perspCanvas) return;
    const a = document.createElement('a');
    a.href = perspCanvas.toDataURL('image/png');
    a.download = 'perspective-grid.png';
    a.click();
  }
  
  // ============================================================
  // COLOR PALETTE
  // ============================================================
  function rndHex() {
    const h = s => ('0'+Math.round(s).toString(16)).slice(-2);
    const r = Math.floor(Math.random()*200+30), g = Math.floor(Math.random()*200+30), b = Math.floor(Math.random()*200+30);
    return '#' + h(r) + h(g) + h(b);
  }
  
  function generatePalette() {
    const n = Math.floor(Math.random()*2)+4;
    const colors = [];
    const base = [Math.random()*360, 0.5+Math.random()*0.4, 0.4+Math.random()*0.3];
    for (let i=0; i<n; i++) {
      const hue = (base[0] + i*(360/n)) % 360;
      colors.push(hslToHex(hue, base[1], base[2] + (Math.random()-0.5)*0.2));
    }
    STATE.paletteColors = colors;
    renderPalette();
  }
  
  function hslToHex(h,s,l) {
    l=Math.max(0.1,Math.min(0.9,l));
    const a=s*Math.min(l,1-l);
    const f=n=>{const k=(n+h/30)%12; const c=l-a*Math.max(Math.min(k-3,9-k,1),-1); return Math.round(255*c).toString(16).padStart(2,'0');};
    return '#'+f(0)+f(8)+f(4);
  }
  
  function renderPalette() {
    const pd = document.getElementById('palette-display');
    pd.innerHTML = '';
    STATE.paletteColors.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'palette-swatch';
      sw.style.background = c;
      const hex = document.createElement('span');
      hex.className = 'palette-hex';
      hex.textContent = c.toUpperCase();
      sw.appendChild(hex);
      pd.appendChild(sw);
    });
  }
  
  let mixerTarget = {r:180, g:90, b:40};
  function newMixerTarget() {
    mixerTarget = {r:Math.floor(Math.random()*220)+20, g:Math.floor(Math.random()*220)+20, b:Math.floor(Math.random()*220)+20};
    document.getElementById('mixer-target').style.background = `rgb(${mixerTarget.r},${mixerTarget.g},${mixerTarget.b})`;
    document.getElementById('mixer-score').textContent = '—%';
    document.getElementById('mix-r').value = 128; document.getElementById('mix-g').value = 128; document.getElementById('mix-b').value = 128;
    updateMixer();
  }
  
  function updateMixer() {
    const r=parseInt(document.getElementById('mix-r').value), g=parseInt(document.getElementById('mix-g').value), b=parseInt(document.getElementById('mix-b').value);
    document.getElementById('mix-r-val').textContent = r;
    document.getElementById('mix-g-val').textContent = g;
    document.getElementById('mix-b-val').textContent = b;
    document.getElementById('mixer-yours').style.background = `rgb(${r},${g},${b})`;
    const diff = (Math.abs(r-mixerTarget.r)+Math.abs(g-mixerTarget.g)+Math.abs(b-mixerTarget.b));
    const score = Math.max(0, Math.round(100 - diff/7.65));
    document.getElementById('mixer-score').textContent = score + '%';
  }
  
  // ============================================================
  // VALUE SCALE
  // ============================================================
  const VALUE_TARGETS = [255, 200, 150, 100, 50];
  
  function initValueRows() {
    const cont = document.getElementById('value-rows');
    cont.innerHTML = '';
    VALUE_TARGETS.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'value-row';
      row.innerHTML = `
        <div class="value-target" style="background:rgb(${v},${v},${v})"></div>
        <input type="range" class="value-slider" min="0" max="255" value="128" id="vs-${i}" oninput="updateValueSwatch(${i})">
        <div class="value-swatch" id="vsw-${i}" style="background:rgb(128,128,128)"></div>
        <span class="value-score" id="vsc-${i}">—</span>`;
      cont.appendChild(row);
    });
  }
  
  function updateValueSwatch(i) {
    const v = parseInt(document.getElementById('vs-' + i).value);
    document.getElementById('vsw-' + i).style.background = `rgb(${v},${v},${v})`;
  }
  
  function checkValues() {
    let total = 0;
    VALUE_TARGETS.forEach((t,i) => {
      const v = parseInt(document.getElementById('vs-' + i).value);
      const diff = Math.abs(v - t);
      const sc = Math.max(0, Math.round(100 - diff/2.55));
      document.getElementById('vsc-' + i).textContent = sc + '%';
      total += sc;
    });
    document.getElementById('value-total-score').textContent = 'Average: ' + Math.round(total / VALUE_TARGETS.length) + '%';
  }
  
  function resetValues() {
    VALUE_TARGETS.forEach((v,i) => {
      document.getElementById('vs-' + i).value = 128;
      updateValueSwatch(i);
      document.getElementById('vsc-' + i).textContent = '—';
    });
    document.getElementById('value-total-score').textContent = '';
  }
  
  // Gradient canvas
  let gradientDrawing = false, gLastX=0, gLastY=0;
  function initGradientCanvas() {
    const gc = document.getElementById('gradient-canvas');
    if (!gc) return;
    const ctx = gc.getContext('2d');
    gc.addEventListener('mousedown', e => { gradientDrawing=true; const p=getPos(gc,e); gLastX=p.x; gLastY=p.y; });
    gc.addEventListener('mousemove', e => {
      if (!gradientDrawing) return;
      const p=getPos(gc,e);
      ctx.strokeStyle = document.getElementById('grad-color').value;
      ctx.lineWidth = parseInt(document.getElementById('grad-brush').value);
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(gLastX,gLastY); ctx.lineTo(p.x,p.y); ctx.stroke();
      gLastX=p.x; gLastY=p.y;
    });
    gc.addEventListener('mouseup', () => gradientDrawing=false);
    gc.addEventListener('mouseleave', () => gradientDrawing=false);
  }
  
  function clearGradCanvas() {
    const gc = document.getElementById('gradient-canvas');
    if (!gc) return;
    gc.getContext('2d').clearRect(0,0,gc.width,gc.height);
    gc.getContext('2d').fillStyle='#fff'; gc.getContext('2d').fillRect(0,0,gc.width,gc.height);
  }
  
  // ============================================================
  // PRACTICE LOG
  // ============================================================
  let currentRating = 0;
  function setRating(n) {
    currentRating = n;
    document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('on', i<n));
  }
  
  function toggleSkill(el) { el.classList.toggle('selected'); }
  
  function saveSession() {
    const dur = parseInt(document.getElementById('log-duration').value) || 0;
    const skills = [...document.querySelectorAll('.skill-tag.selected')].map(t=>t.textContent);
    const notes = document.getElementById('log-notes').value;
    if (!dur) { alert('Please enter a duration.'); return; }
  
    const session = {
      date: new Date().toISOString().slice(0,10),
      time: new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
      duration: dur,
      skills,
      rating: currentRating,
      notes,
    };
    STATE.sessions.unshift(session);
    saveStateLS();
    updateDashboard();
    renderLog();
  
    // Reset form
    document.getElementById('log-duration').value = '';
    document.getElementById('log-notes').value = '';
    document.querySelectorAll('.skill-tag').forEach(t=>t.classList.remove('selected'));
    setRating(0);
  }
  
  function renderLog() {
    const list = document.getElementById('log-list');
    if (!STATE.sessions.length) { list.innerHTML='<div style="font-size:13px;color:var(--text3);">No sessions logged yet. Complete your first session above!</div>'; return; }
    list.innerHTML = '';
    STATE.sessions.slice(0,20).forEach(s => {
      const el = document.createElement('div');
      el.className = 'log-entry';
      el.innerHTML = `
        <div class="log-date">${s.date}<br><span style="color:var(--text3)">${s.time||''}</span></div>
        <div class="log-skills">${(s.skills||[]).map(sk=>`<span class="log-skill-pill">${sk}</span>`).join('')}</div>
        <div class="log-time">${s.duration}m</div>
        <div class="log-stars">${'★'.repeat(s.rating||0)}</div>`;
      list.appendChild(el);
    });
  }
  
  function exportLog() {
    const json = JSON.stringify(STATE.sessions, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json],{type:'application/json'}));
    a.download = 'atelier-practice-log.json';
    a.click();
  }
  
  // ============================================================
  // LEARN TO DRAW — Video Search & Step-by-Step Guides
  // ============================================================
  
  // Built‑in step‑by‑step guides for common queries
  const GUIDE_LIBRARY = {
    'rose': {
      title: 'How to Draw a Rose',
      description: 'Follow these 6 steps to sketch a beautiful rose from a simple spiral.',
      steps: [
        'Start with a small spiral in the center for the bud.',
        'Add a larger, overlapping petal around the spiral.',
        'Draw two side petals that wrap outward.',
        'Add the stem with a few small thorns.',
        'Include leaves with jagged edges on the stem.',
        'Shade the inner petals darker and the outer petals lighter.'
      ]
    },
    'anime eyes': {
      title: 'How to Draw Anime Eyes',
      description: 'Create expressive anime eyes in 5 clear steps.',
      steps: [
        'Sketch the upper eyelid with a slight curve.',
        'Draw the lower eyelid and the iris (a large oval).',
        'Add the pupil and a highlight circle.',
        'Draw the eyelashes as small, angled strokes.',
        'Add shading to the top of the iris and a few small highlights.'
      ]
    },
    'perspective': {
      title: 'How to Draw in Perspective',
      description: 'Learn the basics of 1‑point perspective.',
      steps: [
        'Draw a horizontal horizon line across your page.',
        'Place a single vanishing point on the horizon line.',
        'Draw a rectangular box in front of the vanishing point.',
        'Connect the corners of the box to the vanishing point with light lines.',
        'Draw a second, smaller box in the background along the same lines.',
        'Erase the guide lines to leave your two boxes in perspective.'
      ]
    },
    'hand': {
      title: 'How to Draw a Hand',
      description: 'A simple approach to drawing a hand in 6 steps.',
      steps: [
        'Draw a large oval for the palm (slightly flattened).',
        'Add four thin, overlapping ovals for the fingers (folded slightly).',
        'Draw a smaller oval for the thumb, overlapping the palm.',
        'Refine the finger shapes, adding joints as small circles.',
        'Add the knuckle details and fingernails.',
        'Erase the construction lines and add light shading.'
      ]
    },
    'portrait': {
      title: 'How to Draw a Portrait',
      description: 'A step‑by‑step guide to drawing a face from the front.',
      steps: [
        'Draw an oval for the head, and a vertical line down the center.',
        'Draw a horizontal line halfway down for the eyes.',
        'Halfway between the eyes and chin, draw the nose line.',
        'Halfway between the nose and chin, draw the mouth line.',
        'Sketch the eyes, nose, and mouth using these guide lines.',
        'Add the ears (align with the eyes and nose) and hair outline.'
      ]
    }
  };
  
  // YouTube search fallback: direct video links for common topics
  const VIDEO_LINKS = {
    'draw a rose': 'https://www.youtube.com/embed/1s8nw2qFzKs',
    'anime eyes': 'https://www.youtube.com/embed/1t9QQM5qH5I',
    'perspective': 'https://www.youtube.com/embed/7TxL-1sMSYU',
    'hand drawing': 'https://www.youtube.com/embed/0u6j50I4n8I',
    'portrait': 'https://www.youtube.com/embed/1EPNYWeEf1U',
    'gesture drawing': 'https://www.youtube.com/embed/74HRzLwK7QI',
    'shading': 'https://www.youtube.com/embed/16E5hA4tR-I',
    'color theory': 'https://www.youtube.com/embed/9DqE7VvHj5A'
  };
  
  function performSearch() {
    const query = document.getElementById('learn-search').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('learn-results');
    const guideContainer = document.getElementById('learn-guide');
  
    if (!query) {
      resultsContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text3);background:var(--bg2);border-radius:var(--radius-lg);border:1px solid var(--border);">
          <div style="font-size:40px;margin-bottom:12px;">🔍</div>
          <p style="font-size:16px;color:var(--text2);">Please enter a search term</p>
          <p style="font-size:13px;color:var(--text3);margin-top:4px;">Try: draw a rose, anime eyes, perspective, hand, portrait</p>
        </div>
      `;
      guideContainer.style.display = 'none';
      return;
    }
  
    // 1. Check for built‑in step‑by‑step guide
    let guideKey = null;
    for (const key of Object.keys(GUIDE_LIBRARY)) {
      if (query.includes(key)) { guideKey = key; break; }
    }
  
    if (guideKey) {
      const guide = GUIDE_LIBRARY[guideKey];
      document.getElementById('guide-title').textContent = guide.title;
      document.getElementById('guide-description').textContent = guide.description;
      const stepsDiv = document.getElementById('guide-steps');
      stepsDiv.innerHTML = guide.steps.map((s, i) =>
        `<div style="display:flex;gap:12px;padding:10px 14px;background:var(--surface);border-radius:8px;border-left:3px solid var(--accent);">
          <span style="font-weight:600;color:var(--accent);font-size:14px;">${i+1}.</span>
          <span style="color:var(--text2);font-size:14px;">${s}</span>
        </div>`
      ).join('');
      guideContainer.style.display = 'block';
    } else {
      guideContainer.style.display = 'none';
    }
  
    // 2. Find matching video (fallback)
    let videoId = null;
    for (const [key, url] of Object.entries(VIDEO_LINKS)) {
      if (query.includes(key)) { videoId = url; break; }
    }
  
    // 3. Build results
    let resultsHTML = '';
  
    if (videoId) {
      resultsHTML += `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
          <div style="position:relative;padding-bottom:56.25%;height:0;">
            <iframe src="${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>
          </div>
          <div style="padding:12px 16px;font-size:13px;color:var(--text2);">
            <strong style="color:var(--text);">${query}</strong> — tutorial video
          </div>
        </div>
      `;
    } else {
      // Fallback: show a generic placeholder with tips
      resultsHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:30px 20px;color:var(--text3);background:var(--bg2);border-radius:var(--radius-lg);border:1px solid var(--border);">
          <div style="font-size:40px;margin-bottom:12px;">🎨</div>
          <p style="font-size:16px;color:var(--text2);">No specific video found for "<strong>${query}</strong>"</p>
          <p style="font-size:13px;margin-top:8px;">Try searching for: <em>draw a rose, anime eyes, perspective, hand, portrait</em></p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;">
            ${Object.keys(GUIDE_LIBRARY).map(k => `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('learn-search').value='${k}';performSearch();">${k}</button>`).join('')}
          </div>
        </div>
      `;
    }
  
    resultsContainer.innerHTML = resultsHTML;
  }
  
  function clearSearch() {
    document.getElementById('learn-search').value = '';
    document.getElementById('learn-results').innerHTML = '';
    document.getElementById('learn-guide').style.display = 'none';
  }
  
  // Add event listener for Enter key in search input
  document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('learn-search');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
      });
    }
  });
  
  // ============================================================
  // INIT
  // ============================================================
  window.addEventListener('load', () => {
    loadState();
    updateDashboard();
    renderLog();
    nextPrompt();
    updateTimerDisplay();
    generatePalette();
    newMixerTarget();
    initValueRows();
    initGradientCanvas();
  
    const today = new Date();
    document.getElementById('dash-date').textContent = today.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  });