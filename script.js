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
let shroomEffect = { active: false, start: 0, duration: 6000 };

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
      shroomEffect.duration = 6000; // ms
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
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  // background
  ctx.fillStyle = '#071428';
  ctx.fillRect(0,0,WIDTH,HEIGHT);

  // food (map to canvas)
  if(food){
    const fx = mod(food.x, WIDTH);
    const fy = mod(food.y, HEIGHT);
    if(food.type === 'shroom'){
      // draw a simple shroom: purple cap + white stem
      // cap
      ctx.beginPath();
      ctx.fillStyle = '#9b59b6';
      ctx.arc(fx, fy-3, 10, Math.PI, 0);
      ctx.fill();
      // spots
      ctx.fillStyle = '#ffd9ff';
      ctx.beginPath(); ctx.arc(fx-4, fy-6, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx+3, fy-7, 1.5, 0, Math.PI*2); ctx.fill();
      // stem
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx-3, fy-3, 6, 8);
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // snake body (map points to canvas coordinates)
  for(let i=0;i<path.length;i++){
    const p = path[i];
    const px = mod(p.x, WIDTH);
    const py = mod(p.y, HEIGHT);
    const t = i / path.length;
    const size = 8 * (1 - t) + 3; // head bigger
    ctx.fillStyle = i===0 ? '#4ee1a0' : '#2bd08a';
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI*2);
    ctx.fill();
  }

  // head highlight (mapped)
  ctx.fillStyle = '#0b1f13';
  ctx.beginPath();
  ctx.arc(mod(head.x, WIDTH), mod(head.y, HEIGHT), 3, 0, Math.PI*2);
  ctx.fill();

  // shroom overlay effect (subtle RGB flows)
  if(shroomEffect.active){
    const now = Date.now();
    const elapsed = now - shroomEffect.start;
    const t = Math.max(0, Math.min(1, elapsed / shroomEffect.duration));
    // fade out at the end
    const globalAlpha = 0.16 * (1 - t); // max 0.16, fades to 0
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // draw three moving soft blobs (red, green, blue)
    const colors = ['rgba(255,80,80,', 'rgba(80,255,120,', 'rgba(80,160,255,'];
    const baseSpeed = 30; // px/s
    for(let i=0;i<3;i++){
      const phase = (now/1000) * (0.2 + i*0.1) + i*2.1;
      const x = (Math.sin(phase*0.9 + i) * 0.5 + 0.5) * WIDTH;
      const y = (Math.cos(phase*0.7 + i*1.3) * 0.5 + 0.5) * HEIGHT;
      const radius = 160 + 80*Math.sin(phase + i);
      // draw radial gradient circle with low alpha
      const grad = ctx.createRadialGradient(x,y,0,x,y,radius);
      grad.addColorStop(0, colors[i] + (globalAlpha*0.85) + ')');
      grad.addColorStop(1, colors[i] + '0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    if(elapsed >= shroomEffect.duration) shroomEffect.active = false;
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
