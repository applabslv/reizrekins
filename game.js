'use strict';

/* ============================================================
   Reizrēķins debesīs — reizināšanas tabulas lidmašīnu spēle
   ============================================================ */

// ---------- konstantes ----------
const VW = 1280, VH = 720;            // virtuālā izšķirtspēja
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SPEEDS = [1, 2, 3, 4, 5];
const LIVES_START = 5;
const FACTORS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const CHOICES = [2, 3, 4];            // atbilžu mākoņu skaits
const STORM_LANES = 2;                // vienmēr 2 negaisa mākoņi sienā
const LANE_CENTER = 381, LANE_SPAN = 460, LANE_GAP_MAX = 113;

// Joslu skaits = atbilžu skaits + negaisa mākoņi. Aug/sarūk līdz ar izvēlēm.
let LANES_Y = [], LANE_GAP = LANE_GAP_MAX, CLOUD_R = 74;
function setupLanes(choices) {
  const n = choices + STORM_LANES;
  LANE_GAP = Math.min(LANE_GAP_MAX, LANE_SPAN / (n - 1));
  CLOUD_R = Math.min(74, LANE_GAP * 0.78);
  const top = LANE_CENTER - LANE_GAP * (n - 1) / 2;
  LANES_Y = Array.from({ length: n }, (_, i) => top + i * LANE_GAP);
}
setupLanes(3);
const PLANE_X = 260;
const QUESTION_TIME = 15;             // sekundes līdz mākoņu sienai
const LS_KEY = 'reizrekins';

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('game'), ctx = canvas.getContext('2d');
const hud = $('hud'), hudTime = $('hud-time'),
      hudLives = $('hud-lives'), hudScore = $('hud-score');
const questionBar = $('question-bar'), qText = $('q-text'), qFill = $('qtimer-fill'),
      countdownEl = $('countdown'), feedbackEl = $('feedback');
const panels = {
  menu: $('menu'), pause: $('pause'), gameover: $('gameover'),
  answers: $('answers'), leaderboard: $('leaderboard'),
};

// ---------- stāvoklis ----------
let settings = loadJSON('settings', { table: 12, speed: 2, choices: 3, lang: null, muted: false });
if (!CHOICES.includes(settings.choices)) settings.choices = 3;
// Pirmajā palaišanā valodu ņemam no pārlūka, tālāk — ko lietotājs izvēlējies.
lang = STRINGS[settings.lang] ? settings.lang : detectLang();
let state = 'menu';        // menu | countdown | playing | feedback | paused | gameover
let lbReturnTo = 'menu';
let scaleFit = 1, offX = 0, offY = 0;

const game = {
  table: 12, speed: 2,
  lives: LIVES_START, score: 0,
  deck: [], deckIdx: 0,
  factor: 1, answer: 0,
  waveValues: [],          // [pareizā, nepareizā, nepareizā]
  qTimer: 0, wallSpawned: false,
  clouds: [],              // {x, lane, value, correct, storm, alpha, hit, wall}
  smoke: [], smokeT: 0,
  results: [],             // {factor, ok}
  planeLane: 2, planeY: LANES_Y[2], planeTilt: 0,
  elapsed: 0,              // ms
  cloudSpeed: 260,
  countdownT: 0, countdownN: 3,
  feedbackT: 0, feedbackOK: false,
  bob: 0,
  cityX: 0,                // pilsētas paralakses nobīde
};

// fona elementi
const bgClouds = [], skyline1 = [], skyline2 = [];

// lidmašīnas attēli (CC0, opengameart.org/content/free-plane-sprite)
const planeImgs = { fly1: new Image(), fly2: new Image(), dead: new Image() };
planeImgs.fly1.src = 'assets/plane-fly1.png';
planeImgs.fly2.src = 'assets/plane-fly2.png';
planeImgs.dead.src = 'assets/plane-dead.png';

// ================= AUDIO =================
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
  if (settings.muted) return;
  const c = ac(), t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
const sfx = {
  tick: () => tone(950, 0.08, 'square', 0.12),
  go:   () => tone(620, 0.25, 'square', 0.15, 0, 1050),
  correct: () => { tone(660, 0.12, 'triangle', 0.25); tone(880, 0.14, 'triangle', 0.25, 0.1); tone(1100, 0.2, 'triangle', 0.22, 0.2); },
  wrong: () => { tone(220, 0.28, 'sawtooth', 0.18, 0, 160); tone(110, 0.3, 'square', 0.12, 0.02); },
  swoosh: () => tone(300, 0.12, 'sine', 0.08, 0, 500),
  warn: () => { tone(880, 0.09, 'square', 0.16); tone(880, 0.09, 'square', 0.16, 0.14); tone(660, 0.14, 'square', 0.16, 0.28); },
  over: () => { tone(520, 0.2, 'triangle', 0.2); tone(390, 0.2, 'triangle', 0.2, 0.2); tone(260, 0.45, 'triangle', 0.2, 0.4); },
  best: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, i * 0.12)); },
};

// ================= SAGLABĀŠANA =================
function loadJSON(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(LS_KEY + '.' + key)) }; }
  catch { return { ...fallback }; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(LS_KEY + '.' + key, JSON.stringify(val)); } catch {}
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY + '.scores')) || []; }
  catch { return []; }
}
// Sarežģītība: lielāka tabula, vairāk izvēļu un lielāks ātrums = grūtāk.
const complexity = (s) => s.table * 100 + (s.choices || 3) * 10 + s.speed;
// Kārtojam: vispirms sarežģītība, tad pareizība, tad laiks.
const cmpScores = (a, b) =>
  complexity(b) - complexity(a) || b.score - a.score || a.time - b.time;

function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort(cmpScores);
  localStorage.setItem(LS_KEY + '.scores', JSON.stringify(scores.slice(0, 30)));
  // Rekords ir labākais tieši šim līmenim — citādi iesācējs ar 2×
  // nekad neredzētu "Jauns rekords!".
  const sameLevel = scores.filter(s =>
    s.table === entry.table && s.speed === entry.speed && (s.choices || 3) === entry.choices);
  return sameLevel[0] === entry && entry.score > 0;
}

// ================= PALĪGI =================
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function showPanel(name) {
  for (const k in panels) panels[k].classList.toggle('hidden', k !== name);
  if (!name) for (const k in panels) panels[k].classList.add('hidden');
}

// ================= IZMĒRI =================
let stageW = 0, stageH = 0;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  stageW = w; stageH = h;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  scaleFit = Math.min(w / VW, h / VH);
  offX = (w - VW * scaleFit) / 2;
  offY = (h - VH * scaleFit) / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { setTimeout(resize, 200); setTimeout(resize, 600); });
new ResizeObserver(resize).observe(stage);
window.visualViewport?.addEventListener('resize', resize);

// ================= FONS =================
function initBackground() {
  bgClouds.length = 0; skyline1.length = 0; skyline2.length = 0;
  for (let i = 0; i < 9; i++) {
    bgClouds.push({ x: rnd(0, VW), y: rnd(30, VH * 0.75), s: rnd(0.35, 0.85), v: rnd(6, 20), dark: Math.random() < 0.4 });
  }
  let x = -40;
  while (x < VW + 100) { const w = irnd(70, 150); skyline2.push({ x, w, h: irnd(120, 260) }); x += w + irnd(8, 30); }
  x = -40;
  while (x < VW + 100) { const w = irnd(60, 120); skyline1.push({ x, w, h: irnd(60, 170), ant: Math.random() < 0.3 }); x += w + irnd(14, 44); }
}

// ================= SPĒLES GAITA =================
function startGame() {
  game.table = settings.table;
  game.speed = settings.speed;
  game.choices = settings.choices;
  setupLanes(game.choices);
  game.lives = LIVES_START;
  game.score = 0;
  game.deck = shuffle([...FACTORS]);
  game.deckIdx = 0;
  game.results = [];
  game.clouds = [];
  game.smoke = [];
  game.planeLane = Math.floor(LANES_Y.length / 2);
  game.planeY = LANES_Y[game.planeLane];
  game.elapsed = 0;
  game.cloudSpeed = 150 + game.speed * 62;   // px/s @ 1280 platuma
  showPanel(null);
  hud.classList.remove('hidden');
  questionBar.classList.add('hidden');
  $('btn-pause').classList.remove('hidden');
  updateHUD();
  nextQuestion();
}

function nextQuestion() {
  if (game.deckIdx >= game.deck.length || game.lives <= 0) { endGame(); return; }
  game.factor = game.deck[game.deckIdx];
  game.answer = game.table * game.factor;
  game.clouds = [];
  questionBar.classList.add('hidden');
  state = 'countdown';
  game.countdownN = 3;
  game.countdownT = 0;
  countdownEl.textContent = '3';
  countdownEl.classList.remove('hidden');
  countdownEl.classList.add('pop');
  sfx.tick();
}

function spawnQuestion() {
  const wrong = new Set();
  const tb = game.table, f = game.factor, ans = game.answer;
  const candidates = shuffle([
    tb * (f - 1), tb * (f + 1), tb * (f + 2), tb * (f - 2),
    ans + irnd(1, 3), ans - irnd(1, 3),
    (tb - 1) * f, (tb + 1) * f,
  ].filter(v => v > 0 && v !== ans));
  const need = game.choices - 1;
  for (const v of candidates) { if (wrong.size < need && !wrong.has(v)) wrong.add(v); }
  game.waveValues = shuffle([ans, ...wrong]);
  game.qTimer = 0;
  game.wallSpawned = false;
  game.clouds = [];
  qText.textContent = `${game.table} × ${game.factor} = ?`;
  qFill.style.width = '100%';
  qFill.style.background = '#4ade80';
  questionBar.classList.remove('hidden');
  state = 'playing';
  spawnWave(false);
}

// parasts vilnis: atbilžu mākoņi izklaidus (pārējās joslas brīvas — var izvairīties);
// siena: visas joslas aizņemtas — atbildes + 2 negaisa mākoņi.
// Sienā mākoņi nedrīkst stāvēt vienā taisnā līnijā — katram neliela nobīde.
// Pietiekami maza, lai siena paliktu siena (visas joslas aizņemtas).
const wallJitter = () => rnd(-70, 70);

function spawnWave(wall) {
  const lanes = shuffle(LANES_Y.map((_, i) => i));
  game.waveValues.forEach((v, i) => {
    game.clouds.push({
      x: VW + 160 + (wall ? wallJitter() : i * 300 + rnd(0, 150)),
      lane: lanes[i],
      value: v,
      correct: v === game.answer,
      storm: false,
      alpha: 1, hit: false, wall,
      puffSeed: Math.random() * 10,
    });
  });
  if (wall) {
    for (let i = game.waveValues.length; i < lanes.length; i++) {
      game.clouds.push({
        x: VW + 160 + wallJitter(), lane: lanes[i], value: null, correct: false,
        storm: true, alpha: 1, hit: false, wall,
        puffSeed: Math.random() * 10,
      });
    }
    game.wallSpawned = true;
    sfx.warn();
  }
}

function resolveAnswer(ok, cloud) {
  state = 'feedback';
  game.feedbackT = 0;
  game.feedbackOK = ok;
  game.results.push({ factor: game.factor, ok });
  if (cloud) cloud.hit = true;
  if (ok) {
    game.score++;
    sfx.correct();
    // U+FE0E = teksta (nevis emoji) variants, lai ķeksis pārmanto CSS krāsu
    feedbackEl.innerHTML = t('fb.correct') + ' <span class="fb-mark">✔︎</span>';
    feedbackEl.className = 'good';
  } else {
    game.lives--;
    sfx.wrong();
    feedbackEl.innerHTML = t('fb.wrong') + ' <span class="fb-mark">✘︎</span>' +
      `<span class="fb-eq">${game.table} × ${game.factor} = <b>${game.answer}</b></span>`;
    feedbackEl.className = 'bad';
  }
  game.deckIdx++;
  updateHUD();
}

function endGame() {
  state = 'gameover';
  hud.classList.add('hidden');
  questionBar.classList.add('hidden');
  $('btn-pause').classList.add('hidden');
  feedbackEl.classList.add('hidden');
  $('go-score').textContent = game.score;
  $('go-time').textContent = fmtTime(game.elapsed);
  const isBest = saveScore({
    score: game.score, time: game.elapsed,
    table: game.table, speed: game.speed, choices: game.choices, date: Date.now(),
  });
  $('go-best').classList.toggle('hidden', !isBest);
  $('go-title').textContent = t(game.lives <= 0 ? 'go.over' : 'go.win');
  showPanel('gameover');
  if (isBest) sfx.best(); else sfx.over();
}

function updateHUD() {
  hudLives.textContent = '❤'.repeat(game.lives) + '🖤'.repeat(LIVES_START - game.lives);
  hudScore.textContent = `✓ ${game.score}/${game.results.length}`;
}

// ================= ATJAUNOŠANA =================
function update(dt) {
  game.bob += dt * 3;

  // fona mākoņi kustas vienmēr
  for (const c of bgClouds) {
    c.x -= c.v * dt;
    if (c.x < -220) { c.x = VW + 220; c.y = rnd(30, VH * 0.75); }
  }

  // pilsēta slīd līdzi, kamēr lidmašīna lido (pauzē un spēles galā stāv)
  if (state === 'playing' || state === 'countdown' || state === 'feedback' || state === 'menu') {
    const flying = state === 'playing' || state === 'feedback';
    game.cityX += (flying ? game.cloudSpeed * 0.16 : 22) * dt;
  }

  if (state === 'countdown') {
    game.countdownT += dt;
    if (game.countdownT >= 0.65) {
      game.countdownT = 0;
      game.countdownN--;
      if (game.countdownN <= 0) {
        countdownEl.classList.add('hidden');
        sfx.go();
        spawnQuestion();
      } else {
        countdownEl.textContent = game.countdownN;
        countdownEl.classList.remove('pop');
        void countdownEl.offsetWidth;
        countdownEl.classList.add('pop');
        sfx.tick();
      }
    }
  }

  if (state === 'playing' || state === 'feedback') game.elapsed += dt * 1000;

  // dūmu aste
  if (state === 'playing' || state === 'countdown' || state === 'feedback' || state === 'menu') {
    game.smokeT += dt;
    if (game.smokeT > 0.07) {
      game.smokeT = 0;
      game.smoke.push({
        x: PLANE_X - 78, y: game.planeY + Math.sin(game.bob) * 5 + rnd(-4, 4),
        r: rnd(3.5, 6.5), a: 0.55,
      });
    }
    for (const p of game.smoke) {
      p.x -= (game.cloudSpeed * 0.55 + 40) * dt;
      p.r += dt * 9;
      p.a -= dt * 0.55;
    }
    game.smoke = game.smoke.filter(p => p.a > 0);
  }

  // lidmašīnas kustība
  const targetY = LANES_Y[game.planeLane];
  const dy = targetY - game.planeY;
  game.planeY += dy * Math.min(1, dt * 9);
  game.planeTilt = Math.max(-0.35, Math.min(0.35, dy * 0.004));

  if (state === 'playing') {
    game.qTimer += dt;
    if (!game.wallSpawned && game.qTimer >= QUESTION_TIME) spawnWave(true);

    // laika josla zem jautājuma
    const rem = Math.max(0, 1 - game.qTimer / QUESTION_TIME);
    qFill.style.width = (rem * 100) + '%';
    qFill.style.background = rem > 0.5 ? '#4ade80' : rem > 0.22 ? '#fbbf24' : '#f87171';

    let wallMissed = false;
    for (const c of game.clouds) {
      c.x -= game.cloudSpeed * dt;
      // sadursme
      const closeX = Math.abs(c.x - (PLANE_X + 55)) < 62;
      const closeY = Math.abs(LANES_Y[c.lane] - game.planeY) < LANE_GAP / 2 + 4;
      if (closeX && closeY) { resolveAnswer(c.storm ? false : c.correct, c); return; }
      // sienai garām tikt nedrīkst
      if (c.wall && c.correct && c.x < PLANE_X - 140) wallMissed = true;
    }
    if (wallMissed) { resolveAnswer(false, null); return; }

    // vilnis pilnībā garām — nākamais vilnis (kamēr nav sienas)
    game.clouds = game.clouds.filter(c => c.x > -170);
    if (!game.clouds.length && !game.wallSpawned) spawnWave(false);
  }

  if (state === 'feedback') {
    game.feedbackT += dt;
    for (const c of game.clouds) {
      c.alpha = Math.max(0, c.alpha - dt * 2);
      if (c.hit) c.x -= game.cloudSpeed * 0.3 * dt;
    }
    feedbackEl.classList.remove('hidden');
    if (game.feedbackT > 1.35) {
      feedbackEl.classList.add('hidden');
      nextQuestion();
    }
  }

  hudTime.textContent = fmtTime(game.elapsed);
}

// ================= ZĪMĒŠANA =================
function draw() {
  const w = stageW, h = stageH;
  // debesis
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a6fd6');
  grad.addColorStop(0.55, '#4d97e8');
  grad.addColorStop(1, '#8fc4f2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scaleFit, scaleFit);

  // saule
  ctx.save();
  ctx.globalAlpha = 0.9;
  const sg = ctx.createRadialGradient(1130, 90, 10, 1130, 90, 90);
  sg.addColorStop(0, '#fff7c9');
  sg.addColorStop(0.5, '#ffe27a');
  sg.addColorStop(1, 'rgba(255,226,122,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(1020, -20, 240, 240);
  ctx.restore();

  // pilsētas silueti (aizmugure — pāri visam platumam, arī ārpus 16:9)
  const fullL = -offX / scaleFit, fullR = VW + offX / scaleFit;
  // tālākā rinda kustas lēnāk — paralakse
  drawSkyline(skyline2, VH, 'rgba(190, 214, 240, 0.65)', fullL, fullR, game.cityX * 0.55);
  drawSkyline(skyline1, VH, 'rgba(150, 185, 224, 0.85)', fullL, fullR, game.cityX);

  // fona mākoņi
  for (const c of bgClouds) drawCloud(c.x, c.y, 90 * c.s, c.dark ? 'rgba(90,110,140,.5)' : 'rgba(255,255,255,.75)', null, c.s);

  // atbilžu mākoņi
  for (const c of game.clouds) {
    if (c.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = c.alpha;
    if (c.storm) {
      drawCloud(c.x, LANES_Y[c.lane], CLOUD_R, '#4b5a70', null, 1, c.puffSeed);
      // zibens
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - 8, LANES_Y[c.lane] - 12);
      ctx.lineTo(c.x + 10, LANES_Y[c.lane] + 6);
      ctx.lineTo(c.x - 4, LANES_Y[c.lane] + 10);
      ctx.lineTo(c.x + 12, LANES_Y[c.lane] + 32);
      ctx.stroke();
    } else {
      drawCloud(c.x, LANES_Y[c.lane], CLOUD_R, '#ffffff', String(c.value), 1, c.puffSeed);
    }
    ctx.restore();
  }

  // dūmu aste
  for (const p of game.smoke) {
    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.fillStyle = '#dfe7ef';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // lidmašīna
  drawPlane(PLANE_X, game.planeY + Math.sin(game.bob) * 5, game.planeTilt);

  ctx.restore();

  // malu aizpildījums apakšā (zem 16:9 lauka) — zemes tonis
  if (offY > 1) {
    ctx.fillStyle = '#7fb2df';
    ctx.fillRect(0, h - offY, w, offY);
  }
}

function drawSkyline(list, baseY, color, xL, xR, scroll = 0) {
  const period = VW + 60;
  const shift = ((scroll % period) + period) % period;   // vienmēr [0, period)
  ctx.fillStyle = color;
  for (const b of list) {
    for (let rep = xL - 80 - period; rep < xR + period; rep += period) {
      const bx = b.x + rep + 40 - shift;
      if (bx + b.w < xL || bx > xR) continue;
      ctx.fillRect(bx, baseY - b.h, b.w, b.h + 40);
      if (b.ant) ctx.fillRect(bx + b.w / 2 - 3, baseY - b.h - 26, 6, 26);
      // logi
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = baseY - b.h + 14; wy < baseY - 14; wy += 26) {
        for (let wx = bx + 10; wx < bx + b.w - 12; wx += 22) {
          ctx.fillRect(wx, wy, 9, 12);
        }
      }
      ctx.restore();
    }
  }
}

function drawCloud(x, y, r, color, text, s = 1, seed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const puffs = [
    [-r * 0.75, r * 0.1, r * 0.5],
    [-r * 0.3, -r * 0.28, r * 0.62],
    [r * 0.25, -r * 0.32, r * 0.55],
    [r * 0.7, r * 0.05, r * 0.48],
    [0, r * 0.15, r * 0.7],
  ];
  for (const [px, py, pr] of puffs) {
    ctx.moveTo(px + pr, py);
    ctx.arc(px + Math.sin(seed + px) * 4, py, pr, 0, Math.PI * 2);
  }
  ctx.fill();
  if (text !== null && text !== undefined) {
    ctx.fillStyle = '#233348';
    ctx.font = `900 ${r * 0.62}px 'Nunito', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 2);
  }
  ctx.restore();
}

function drawPlane(x, y, tilt) {
  // sprite: 443x302 -> ~176x120 spēles laukā
  const wrongNow = state === 'feedback' && !game.feedbackOK;
  const img = wrongNow ? planeImgs.dead
    : (Math.floor(game.bob * 4) % 2 ? planeImgs.fly2 : planeImgs.fly1);
  if (!img.complete || !img.naturalWidth) return;
  const w = 176, h = w * img.naturalHeight / img.naturalWidth;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt + (wrongNow ? 0.18 : 0));
  ctx.drawImage(img, -w / 2 - 8, -h / 2, w, h);
  ctx.restore();
}

// ================= CILPA =================
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (state !== 'paused') update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ================= VADĪBA =================
function movePlane(dir) {
  if (state !== 'playing' && state !== 'countdown') return;
  const next = Math.max(0, Math.min(LANES_Y.length - 1, game.planeLane + dir));
  if (next !== game.planeLane) { game.planeLane = next; sfx.swoosh(); }
}

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); movePlane(-1); }
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); movePlane(1); }
  else if (e.key === 'Escape' && state === 'playing') togglePause(true);
});

// skārienvadība — velc uz augšu/leju
let touchY = null, touchMoved = false;
stage.addEventListener('touchstart', e => {
  if (e.target.closest('button') || e.target.closest('.panel')) return;
  touchY = e.touches[0].clientY;
  touchMoved = false;
}, { passive: true });
stage.addEventListener('touchmove', e => {
  if (touchY === null) return;
  const dy = e.touches[0].clientY - touchY;
  if (Math.abs(dy) > 26) {
    movePlane(dy < 0 ? -1 : 1);
    touchY = e.touches[0].clientY;
    touchMoved = true;
  }
}, { passive: true });
stage.addEventListener('touchend', e => {
  // piesitiens augšpusē/apakšpusē arī vada
  if (!touchMoved && touchY !== null && !e.target.closest('button') && !e.target.closest('.panel')
      && (state === 'playing' || state === 'countdown')) {
    const rect = stage.getBoundingClientRect();
    const rel = (touchY - rect.top) / rect.height;
    movePlane(rel < 0.5 ? -1 : 1);
  }
  touchY = null;
}, { passive: true });

// ================= UI =================
function buildPickers() {
  const tp = $('table-picker');
  tp.innerHTML = '';
  for (const tb of TABLES) {
    const b = document.createElement('button');
    b.className = 'pick-btn' + (tb === settings.table ? ' sel' : '');
    b.textContent = tb;
    b.onclick = () => { settings.table = tb; saveJSON('settings', settings); buildPickers(); sfx.tick(); };
    tp.appendChild(b);
  }
  const sp = $('speed-picker');
  sp.innerHTML = '';
  for (const s of SPEEDS) {
    const b = document.createElement('button');
    b.className = 'pick-btn' + (s === settings.speed ? ' sel' : '');
    b.textContent = s;
    b.onclick = () => { settings.speed = s; saveJSON('settings', settings); buildPickers(); sfx.tick(); };
    sp.appendChild(b);
  }
  const cp = $('choice-picker');
  cp.innerHTML = '';
  for (const c of CHOICES) {
    const b = document.createElement('button');
    b.className = 'pick-btn pick-clouds' + (c === settings.choices ? ' sel' : '');
    b.textContent = '☁'.repeat(c);
    b.setAttribute('aria-label', t('aria.choices', { n: c }));
    b.onclick = () => { settings.choices = c; saveJSON('settings', settings); buildPickers(); sfx.tick(); };
    cp.appendChild(b);
  }
  const lp = $('lang-picker');
  lp.innerHTML = '';
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.className = 'pick-btn pick-lang' + (l.code === lang ? ' sel' : '');
    b.textContent = l.label;
    b.title = l.name;
    b.setAttribute('aria-label', l.name);
    b.setAttribute('aria-pressed', String(l.code === lang));
    b.onclick = () => {
      lang = l.code;
      settings.lang = l.code;
      saveJSON('settings', settings);
      applyI18n();
      buildPickers();
      sfx.tick();
    };
    lp.appendChild(b);
  }
}

function togglePause(on) {
  if (on && (state === 'playing' || state === 'countdown' || state === 'feedback')) {
    game.pausedFrom = state;
    state = 'paused';
    showPanel('pause');
  } else if (!on && state === 'paused') {
    state = game.pausedFrom || 'playing';
    showPanel(null);
  }
}

function toMenu() {
  state = 'menu';
  hud.classList.add('hidden');
  questionBar.classList.add('hidden');
  countdownEl.classList.add('hidden');
  feedbackEl.classList.add('hidden');
  $('btn-pause').classList.add('hidden');
  game.clouds = [];
  buildPickers();
  showPanel('menu');
}

function showAnswers() {
  const grid = $('answers-grid');
  grid.innerHTML = '';
  const byFactor = {};
  for (const r of game.results) byFactor[r.factor] = r.ok;
  for (const f of FACTORS) {
    const d = document.createElement('div');
    const ok = byFactor[f];
    d.textContent = `${game.table} × ${f} = ${game.table * f}`;
    if (ok === true) d.className = 'got';
    else if (ok === false) d.className = 'missed';
    grid.appendChild(d);
  }
  showPanel('answers');
}

function showLeaderboard(from) {
  lbReturnTo = from;
  const list = $('lb-list');
  const scores = loadScores().sort(cmpScores);
  list.innerHTML = '';
  if (!scores.length) {
    list.innerHTML = `<div class="lb-empty">${t('lb.empty')}</div>`;
  } else {
    const head = document.createElement('div');
    head.className = 'lb-row head';
    head.innerHTML = `<span>#</span><span>${t('lb.table')}</span>` +
      `<span class="lb-clouds" title="${t('lb.choices')}">☁</span>` +
      `<span>${t('lb.speed')}</span><span>${t('lb.points')}</span><span>${t('lb.time')}</span>`;
    list.appendChild(head);
    scores.slice(0, 10).forEach((s, i) => {
      const r = document.createElement('div');
      r.className = 'lb-row';
      const ch = s.choices || 3;
      r.innerHTML = `<span>${i + 1}.</span><span>${s.table}×</span>` +
        `<span class="lb-clouds" title="${t('aria.choices', { n: ch })}">${ch}</span>` +
        `<span>${s.speed}</span><span>${s.score}/12</span><span>${fmtTime(s.time)}</span>`;
      list.appendChild(r);
    });
  }
  showPanel('leaderboard');
}

// pogas
$('btn-start').onclick = () => { ac(); startGame(); };
$('btn-scores').onclick = () => showLeaderboard('menu');
$('btn-pause').onclick = () => togglePause(true);
$('btn-resume').onclick = () => togglePause(false);
$('btn-restart-pause').onclick = () => startGame();
$('btn-quit').onclick = () => toMenu();
$('btn-again').onclick = () => startGame();
$('btn-go-menu').onclick = () => toMenu();
$('btn-answers').onclick = () => showAnswers();
$('btn-answers-back').onclick = () => showPanel('gameover');
$('btn-go-scores').onclick = () => showLeaderboard('gameover');
$('btn-lb-back').onclick = () => showPanel(lbReturnTo);

$('btn-sound').onclick = () => {
  settings.muted = !settings.muted;
  saveJSON('settings', settings);
  $('btn-sound').textContent = settings.muted ? '🔇' : '🔊';
  if (!settings.muted) sfx.tick();
};


// ================= STARTS =================
applyI18n();
$('btn-sound').textContent = settings.muted ? '🔇' : '🔊';
resize();
initBackground();
buildPickers();
toMenu();
requestAnimationFrame(loop);
