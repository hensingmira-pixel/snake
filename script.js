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
  food = { x: randX(), y: randY() };
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
    score += 1;
    snakeLength += 36; // grow
    speed = Math.min(320, speed + 6); // slight speed up
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
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(fx, fy, 8, 0, Math.PI*2);
    ctx.fill();
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
