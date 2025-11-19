const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// continuous movement settings
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
// offscreen buffer for post-processing/distortion
const bufCanvas = document.createElement('canvas');
bufCanvas.width = WIDTH;
bufCanvas.height = HEIGHT;
const bctx = bufCanvas.getContext('2d');
let head = { x: WIDTH/2, y: HEIGHT/2 };
let angle = 0; // radians
let speed = 160; // pixels per second
let angularSpeed = Math.PI; // rad/s when turning
let snakeLength = 160; // pixels
let path = [ {x: head.x, y: head.y} ]; // array of points from head -> tail
let pathLen = 0; // total length of path
let score = 0;
let food = null;
let running = false;
let lastTime = null;
let turningLeft = false;
let turningRight = false;
// shroom effect state
let shroomEffect = { active: false, start: 0, duration: 9000 };

function resetGame(){
  head = { x: WIDTH/2, y: HEIGHT/2 };
  angle = 0;
  speed = 160;
  snakeLength = 160;
  path = [ {x: head.x, y: head.y} ];
  pathLen = 0;
  score = 0;
  spawnFood();
  updateScore();
}

function spawnFood(){
  const margin = 20;
  function randX(){ return margin + Math.random()*(WIDTH-2*margin); }
  function randY(){ return margin + Math.random()*(HEIGHT-2*margin); }
  // 15% chance to spawn a shroom (special food)
  const isShroom = Math.random() < 0.15;
  food = { x: randX(), y: randY(), type: isShroom ? 'shroom' : 'food' };
}

function updateScore(){
  scoreEl.textContent = score;
  const hi = Math.max(score, Number(localStorage.getItem('snake_high')||0));
  highEl.textContent = hi;
  if(score > hi) localStorage.setItem('snake_high', score);
}

function distance(a,b){
  const dx = a.x-b.x, dy = a.y-b.y; return Math.hypot(dx,dy);
}

function mod(a,m){ return ((a % m) + m) % m; }

function toroidalDelta(a,b,m){
  // minimal delta from b to a on a ring of length m
  let d = a - b;
  d = ((d + m/2) % m + m) % m - m/2;
  return d;
}

function toroidalDistance(a,b){
  const dx = toroidalDelta(a.x, b.x, WIDTH);
  const dy = toroidalDelta(a.y, b.y, HEIGHT);
  return Math.hypot(dx,dy);
}

function step(dt){
  // turn
  if(turningLeft) angle -= angularSpeed * dt;
  if(turningRight) angle += angularSpeed * dt;

  // move head (unwrapped coordinates)
  head.x += Math.cos(angle) * speed * dt;
  head.y += Math.sin(angle) * speed * dt;

  // add to path
  const prev = path[0];
  const seg = { x: head.x, y: head.y };
  const added = distance(seg, prev);
  path.unshift(seg);
  pathLen += added;

  // trim tail to keep pathLen <= snakeLength
  while(pathLen > snakeLength && path.length > 1){
    const a = path[path.length-2];
    const b = path[path.length-1];
    const d = distance(a,b);
    if(pathLen - d >= snakeLength){
      path.pop();
      pathLen -= d;
    } else {
      // shorten last segment
      const keep = snakeLength - (pathLen - d);
      const t = keep / d;
      b.x = a.x + (b.x - a.x) * t;
      b.y = a.y + (b.y - a.y) * t;
      pathLen = snakeLength;
      break;
    }
  }

  // check food using toroidal distance
  if(food && toroidalDistance(head, food) < 14){
    if(food.type === 'shroom'){
      // shroom: trigger RGB flowing overlay, give small growth + score
      shroomEffect.active = true;
      shroomEffect.start = Date.now();
      shroomEffect.duration = 9000; // ms
      score += 2;
      snakeLength += 24;
      // small speed boost
      speed = Math.min(320, speed + 10);
    } else {
      // normal food
      score += 1;
      snakeLength += 36; // grow
      speed = Math.min(320, speed + 6); // slight speed up
    }
    spawnFood();
    updateScore();
  }

  // self collision: check toroidal distance to older points
  for(let i=10;i<path.length;i++){
    const p = path[i];
    if(toroidalDistance(head, p) < 8){
      stop();
      return;
    }
  }
}

function draw(){
  // render the scene into the offscreen buffer first
  bctx.clearRect(0,0,WIDTH,HEIGHT);
  // background
  bctx.fillStyle = '#071428';
  bctx.fillRect(0,0,WIDTH,HEIGHT);

  // food (map to buffer)
  if(food){
    const fx = mod(food.x, WIDTH);
    const fy = mod(food.y, HEIGHT);
    if(food.type === 'shroom'){
      bctx.beginPath();
      bctx.fillStyle = '#9b59b6';
      bctx.arc(fx, fy-3, 10, Math.PI, 0);
      bctx.fill();
      bctx.fillStyle = '#ffd9ff';
      bctx.beginPath(); bctx.arc(fx-4, fy-6, 2, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(fx+3, fy-7, 1.5, 0, Math.PI*2); bctx.fill();
      bctx.fillStyle = '#ffffff';
      bctx.fillRect(fx-3, fy-3, 6, 8);
    } else {
      bctx.fillStyle = '#ff6b6b';
      bctx.beginPath();
      bctx.arc(fx, fy, 8, 0, Math.PI*2);
      bctx.fill();
    }
  }

  // snake body (map points to buffer coordinates)
  for(let i=0;i<path.length;i++){
    const p = path[i];
    const px = mod(p.x, WIDTH);
    const py = mod(p.y, HEIGHT);
    const t = i / path.length;
    const size = 8 * (1 - t) + 3; // head bigger
    bctx.fillStyle = i%4<2
     ? '#ff9bbcff' : '#995b5bff';
    bctx.beginPath();
    bctx.arc(px, py, size, 0, Math.PI*2);
    bctx.fill();
  }

  // head highlight (mapped)
  bctx.fillStyle = '#0b1f13';
  bctx.beginPath();
  bctx.arc(mod(head.x, WIDTH), mod(head.y, HEIGHT), 3, 0, Math.PI*2);
  bctx.fill();

  // shroom overlay effect (intensified RGB flows) - render into buffer
  if(shroomEffect.active){
    const now = Date.now();
    const elapsed = now - shroomEffect.start;
    const t = Math.max(0, Math.min(1, elapsed / shroomEffect.duration));
    const alphaPeak = 0.38; // stronger peak
    const globalAlpha = alphaPeak * (1 - t) * (0.7 + 0.3*Math.sin(now/400));
    bctx.save();
    bctx.globalCompositeOperation = 'screen';
    bctx.filter = 'blur(10px)';
    const colors = ['rgba(255,0,0,', 'rgba(0,255,0,', 'rgba(0,0,255,'];
    for(let i=0;i<3;i++){
      const phase = (now/1000) * (0.8 + i*0.25) + i*1.9;
      const x = (Math.sin(phase*1.1 + i*0.3) * 0.5 + 0.5) * WIDTH;
      const y = (Math.cos(phase*0.9 + i*0.7) * 0.5 + 0.5) * HEIGHT;
      const radius = 420 + 120*Math.sin(phase + i);
      const grad = bctx.createRadialGradient(x,y,0,x,y,radius);
      grad.addColorStop(0, colors[i] + (Math.max(0, globalAlpha*0.95)) + ')');
      grad.addColorStop(0.6, colors[i] + (Math.max(0, globalAlpha*0.45)) + ')');
      grad.addColorStop(1, colors[i] + '0)');
      bctx.fillStyle = grad;
      bctx.beginPath();
      bctx.arc(x,y,radius,0,Math.PI*2);
      bctx.fill();
    }
    bctx.filter = 'none';
    bctx.restore();
    if(elapsed >= shroomEffect.duration) shroomEffect.active = false;
  }

  // copy buffer to main canvas — apply distortion if active
  if(shroomEffect.active){
    const now = Date.now();
    const elapsed = now - shroomEffect.start;
    const tt = Math.max(0, Math.min(1, elapsed / shroomEffect.duration));
    const amp = 8 + 48 * (1 - tt); // stronger at start, eases
    const waveSpeed = 220;
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    const sliceH = 6; // height of each horizontal slice
    for(let y=0;y<HEIGHT;y+=sliceH){
      const norm = y / HEIGHT;
      const dx = Math.sin(norm * Math.PI * 2 + now / waveSpeed) * amp * Math.sin(now/900 + norm*6);
      ctx.drawImage(bufCanvas, 0, y, WIDTH, sliceH, dx, y, WIDTH, sliceH);
    }
  } else {
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.drawImage(bufCanvas, 0, 0);
  }
}

function loop(now){
  if(!lastTime) lastTime = now;
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;
  if(running) step(dt);
  draw();
  requestAnimationFrame(loop);
}

function start(){
  if(running) return;
  running = true;
  try{ canvas.focus(); }catch(e){}
}

function stop(){
  running = false;
  // flash red
  ctx.fillStyle = 'rgba(255,0,0,0.12)';
  ctx.fillRect(0,0,WIDTH,HEIGHT);
}

// focus + controls
canvas.tabIndex = 0;
canvas.style.outline = 'none';
canvas.addEventListener('pointerdown', () => canvas.focus());

window.addEventListener('keydown', e => {
  const key = e.key;
  const target = e.target;
  const tag = target && target.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;
  // prevent scroll for arrows and space
  if(key === 'ArrowLeft' || key === 'ArrowRight' || key === ' ' || key === 'Spacebar' || key === 'Space') e.preventDefault();
  if(key === 'ArrowLeft') turningLeft = true;
  if(key === 'ArrowRight') turningRight = true;
  if(key === 'ArrowUp') { speed = Math.min(400, speed + 20); }
  if(key === 'ArrowDown') { speed = Math.max(30, speed - 20); }
  if(key === ' ') { running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; }
}, {capture:true});

window.addEventListener('keyup', e => {
  if(e.key === 'ArrowLeft') turningLeft = false;
  if(e.key === 'ArrowRight') turningRight = false;
});

// touch: set angle towards tap
canvas.addEventListener('touchend', e => {
  const t = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const tx = t.clientX - rect.left;
  const ty = t.clientY - rect.top;
  const dx = tx - head.x, dy = ty - head.y;
  angle = Math.atan2(dy, dx);
  canvas.focus();
});

startBtn.addEventListener('click', ()=>{ start(); startBtn.blur(); });
pauseBtn.addEventListener('click', ()=>{ running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; });
resetBtn.addEventListener('click', ()=>{ resetGame(); start(); });

// init
resetGame();
requestAnimationFrame(loop);
