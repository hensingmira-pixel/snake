const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

const TILE = 20;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

let snake = [];
let dir = {x:1,y:0};
let nextDir = {x:1,y:0};
let food = null;
let score = 0;
let speed = 8; // ticks per second
let running = false;
let loopId = null;

function resetGame(){
  snake = [ {x:Math.floor(COLS/2), y:Math.floor(ROWS/2)} ];
  dir = {x:1,y:0};
  nextDir = {x:1,y:0};
  score = 0;
  speed = 8;
  spawnFood();
  updateScore();
}

function spawnFood(){
  while(true){
    const x = Math.floor(Math.random()*COLS);
    const y = Math.floor(Math.random()*ROWS);
    if(!snake.some(s => s.x===x && s.y===y)){
      food = {x,y};
      return;
    }
  }
}

function updateScore(){
  scoreEl.textContent = score;
  const hi = Math.max(score, Number(localStorage.getItem('snake_high')||0));
  highEl.textContent = hi;
  if(score>=hi) localStorage.setItem('snake_high', score);
}

function step(){
  // move
  dir = nextDir;
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  // wrap-around
  if(head.x < 0) head.x = COLS - 1;
  if(head.x >= COLS) head.x = 0;
  if(head.y < 0) head.y = ROWS - 1;
  if(head.y >= ROWS) head.y = 0;

  // self collision
  if(snake.some(s => s.x===head.x && s.y===head.y)){
    stop();
    return;
  }

  snake.unshift(head);

  if(food && head.x===food.x && head.y===food.y){
    score += 1;
    speed = Math.min(18, 8 + Math.floor(score/3));
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
  updateScore();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // grid background
  ctx.fillStyle = '#071428';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // food
  if(food){
    ctx.fillStyle = '#ff6b6b';
    drawTile(food.x, food.y);
  }

  // snake
  for(let i=0;i<snake.length;i++){
    const s = snake[i];
    ctx.fillStyle = i===0 ? '#4ee1a0' : '#2bd08a';
    drawTile(s.x,s.y, i===0 ? 4 : 2);
  }
}

function drawTile(x,y,r=0){
  const px = x * TILE;
  const py = y * TILE;
  if(r>0){
    ctx.beginPath();
    ctx.fillRect(px+2, py+2, TILE-4, TILE-4);
    ctx.fill();
  } else {
    ctx.fillRect(px, py, TILE, TILE);
  }
}

function start(){
  if(running) return;
  running = true;
  loop();
}

function stop(){
  running = false;
  if(loopId) cancelAnimationFrame(loopId);
  // flash red on game over
  ctx.fillStyle = 'rgba(255,0,0,0.12)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

let lastTime = 0;
function loop(now=0){
  loopId = requestAnimationFrame(loop);
  const secPerTick = 1 / speed;
  if(!lastTime) lastTime = now;
  const dt = (now - lastTime) / 1000;
  if(dt >= secPerTick){
    lastTime = now;
    if(running) step();
  }
}

// input
window.addEventListener('keydown', e => {
  const key = e.key;
  const target = e.target;
  const tag = target && target.tagName;
  // don't intercept keys when typing in inputs or editable areas
  if(tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;

  // prevent page scrolling for arrow keys and space
  if((key && key.startsWith && key.startsWith('Arrow')) || key === ' ' || key === 'Spacebar' || key === 'Space'){
    e.preventDefault();
  }

  if(key==='ArrowUp' || key==='w' || key==='W') trySetDir(0,-1);
  if(key==='ArrowDown' || key==='s' || key==='S') trySetDir(0,1);
  if(key==='ArrowLeft' || key==='a' || key==='A') trySetDir(-1,0);
  if(key==='ArrowRight' || key==='d' || key==='D') trySetDir(1,0);
  if(key===' ' || key === 'Spacebar' || key === 'Space'){ // space to pause/resume
    if(running) { running=false; pauseBtn.textContent='Resume'; }
    else { running=true; pauseBtn.textContent='Pause'; }
  }
});

function trySetDir(x,y){
  // prevent reversing
  if(x === -dir.x && y === -dir.y) return;
  nextDir = {x,y};
}

// small touch controls for mobile by swiping
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = {x:t.clientX, y:t.clientY};
});
canvas.addEventListener('touchend', e => {
  if(!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if(Math.abs(dx) > Math.abs(dy)){
    if(dx>0) trySetDir(1,0); else trySetDir(-1,0);
  } else {
    if(dy>0) trySetDir(0,1); else trySetDir(0,-1);
  }
  touchStart = null;
});

startBtn.addEventListener('click', ()=>{ start(); startBtn.blur(); });
pauseBtn.addEventListener('click', ()=>{
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
});
resetBtn.addEventListener('click', ()=>{ resetGame(); draw(); start(); });

// init
resetGame();
draw();
