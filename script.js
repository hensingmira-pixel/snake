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
let angularSpeed = Math.PI; // rad/s when turning
// support multiple snakes (for splitting)
let snakes = [];

function makeInitialSnake(){
  return {
    head: { x: WIDTH/2, y: HEIGHT/2 },
    angle: 0,
    speed: 160,
    length: 160,
    path: [ { x: WIDTH/2, y: HEIGHT/2 } ],
    pathLen: 0
  };
}
let score = 0;
let food = null;
let running = false;
let lastTime = null;
let turningLeft = false;
let turningRight = false;
// shroom effect state
let shroomEffect = { active: false, start: 0, duration: 9000 };

function resetGame(){
  snakes = [ makeInitialSnake() ];
  score = 0;
  spawnFood();
  updateScore();
}

function spawnFood(){
  const margin = 20;
  function randX(){ return margin + Math.random()*(WIDTH-2*margin); }
  function randY(){ return margin + Math.random()*(HEIGHT-2*margin); }
  // spawn types: scissors (7%), shroom (15%), food otherwise
  const r = Math.random();
  const type = r < 0.07 ? 'scissors' : (r < 0.22 ? 'shroom' : 'food');
  food = { x: randX(), y: randY(), type };
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
  // update each snake independently; controls apply to all heads simultaneously
  for(let si=0; si<snakes.length; si++){
    const s = snakes[si];
    const now = Date.now();
    const paused = s.pauseUntil && now < s.pauseUntil;
    if(turningLeft) s.angle -= angularSpeed * dt;
    if(turningRight) s.angle += angularSpeed * dt;
    if(paused) continue; // skip movement and food checks while paused

    // move head (unwrapped coordinates)
    s.head.x += Math.cos(s.angle) * s.speed * dt;
    s.head.y += Math.sin(s.angle) * s.speed * dt;

    // add to path
    const prev = s.path[0];
    const seg = { x: s.head.x, y: s.head.y };
    const added = distance(seg, prev);
    s.path.unshift(seg);
    s.pathLen += added;

    // trim tail to keep pathLen <= s.length
    while(s.pathLen > s.length && s.path.length > 1){
      const a = s.path[s.path.length-2];
      const b = s.path[s.path.length-1];
      const d = distance(a,b);
      if(s.pathLen - d >= s.length){
        s.path.pop();
        s.pathLen -= d;
      } else {
        const keep = s.length - (s.pathLen - d);
        const t = keep / d;
        b.x = a.x + (b.x - a.x) * t;
        b.y = a.y + (b.y - a.y) * t;
        s.pathLen = s.length;
        break;
      }
    }

    // check food for this head
    if(food && toroidalDistance(s.head, food) < 14){
      if(food.type === 'shroom'){
        shroomEffect.active = true;
        shroomEffect.start = Date.now();
        shroomEffect.duration = 9000; // ms
        score += 2;
        s.length += 24;
        s.speed = Math.min(320, s.speed + 10);
      } else if(food.type === 'scissors'){
        // scissors: split this snake into two
        splitSnake(si);
      } else {
        score += 1;
        s.length += 36;
        s.speed = Math.min(320, s.speed + 6);
      }
      spawnFood();
      updateScore();
    }
  }

  // collision: check each head against all snakes' bodies
  // collision: heads can bite other snakes (remove bitten snakes)
  const toRemove = new Set();
  const now = Date.now();
  const paused = snakes.map(s => s.pauseUntil && now < s.pauseUntil);
  for(let si=0; si<snakes.length; si++){
    const s = snakes[si];
    // self-collision: head with own body (skip first few points)
    for(let i=10;i<s.path.length;i++){
      const p = s.path[i];
      if(toroidalDistance(s.head, p) < 8){ stop(); return; }
    }
    // if this head is paused, it should not be able to bite others
    if(paused[si]) continue;
    // check against other snakes
    for(let sj=0; sj<snakes.length; sj++){
      if(si === sj) continue;
      const other = snakes[sj];
      for(let i=0; i<other.path.length; i++){
        const p = other.path[i];
        if(toroidalDistance(s.head, p) < 8){
          // head-to-head (i===0) -> shorter snake gets eaten; equal => both
          if(i === 0){
            if(s.length > other.length){ toRemove.add(sj); score += 5; }
            else if(s.length < other.length){ toRemove.add(si); score += 5; }
            else { toRemove.add(si); toRemove.add(sj); }
          } else {
            // s bites other's body -> other gets eaten
            toRemove.add(sj);
            score += Math.max(2, Math.floor(other.length/20));
          }
          break; // stop scanning this other snake
        }
      }
    }
  }

  if(toRemove.size > 0){
    // filter out removed snakes
    snakes = snakes.filter((_, idx) => !toRemove.has(idx));
    if(snakes.length === 0){ stop(); return; }
    updateScore();
  }
}

function pathTotalLength(path){
  let L = 0; for(let i=0;i<path.length-1;i++) L += distance(path[i], path[i+1]); return L;
}

function splitSnake(index){
  const s = snakes[index];
  const total = s.length;
  if(s.path.length < 6) return; // too short to split
  const target = total / 2;
  // walk path to find midpoint position
  let acc = 0; let midIdx = 0; let midT = 0;
  for(let i=0;i<s.path.length-1;i++){
    const a = s.path[i]; const b = s.path[i+1];
    const d = distance(a,b);
    if(acc + d >= target){
      midIdx = i; midT = (target - acc) / d; break;
    }
    acc += d;
  }
  const a = s.path[midIdx]; const b = s.path[midIdx+1];
  const midPoint = { x: a.x + (b.x - a.x) * midT, y: a.y + (b.y - a.y) * midT };
  // assemble two path arrays
  const pathA = s.path.slice(0, midIdx+1);
  pathA[pathA.length-1] = midPoint;
  const pathB = s.path.slice(midIdx+1);
  pathB.unshift(midPoint);
  // compute lengths
  const lenA = Math.max(40, Math.floor(s.length/2));
  const lenB = Math.max(40, s.length - lenA);
  const sA = {
    head: { x: pathA[0].x, y: pathA[0].y }, angle: s.angle, speed: s.speed, length: lenA, path: pathA, pathLen: pathTotalLength(pathA)
  };
  const sB = {
    head: { x: pathB[0].x, y: pathB[0].y }, angle: s.angle, speed: s.speed, length: lenB, path: pathB, pathLen: pathTotalLength(pathB)
  };
  // pause the second/new snake briefly so it doesn't immediately eat the original
  sB.pauseUntil = Date.now() + 1000; // milliseconds
  // replace original with two new snakes
  snakes.splice(index, 1, sA, sB);
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
    } else if(food.type === 'scissors'){
      // simple scissors glyph: two blades crossing
      bctx.save();
      bctx.translate(fx, fy);
      bctx.rotate(Math.PI/6);
      bctx.strokeStyle = '#ffffff';
      bctx.lineWidth = 3;
      bctx.beginPath(); bctx.moveTo(-10,-8); bctx.lineTo(12,10); bctx.stroke();
      bctx.beginPath(); bctx.moveTo(-10,8); bctx.lineTo(12,-10); bctx.stroke();
      bctx.restore();
    } else {
      bctx.fillStyle = '#ff6b6b';
      bctx.beginPath();
      bctx.arc(fx, fy, 8, 0, Math.PI*2);
      bctx.fill();
    }
  }

  // snake body (map points to buffer coordinates)
  // snake bodies (support multiple snakes)
  const palettes = [ ['#4ee1a0','#2bd08a'], ['#ffd36b','#ffb86b'], ['#9bb0ff','#5b8eff'], ['#ff9bbc','#ff6b9b'] ];
  for(let si=0; si<snakes.length; si++){
    const s = snakes[si];
    const pal = palettes[si % palettes.length];
    for(let i=0;i<s.path.length;i++){
      const p = s.path[i];
      const px = mod(p.x, WIDTH);
      const py = mod(p.y, HEIGHT);
      const t = i / s.path.length;
      const size = 8 * (1 - t) + 3; // head bigger
      bctx.fillStyle = (i===0) ? pal[0] : pal[1];
      bctx.beginPath();
      bctx.arc(px, py, size, 0, Math.PI*2);
      bctx.fill();
    }
    // head highlight
    bctx.fillStyle = '#0b1f13';
    bctx.beginPath();
    bctx.arc(mod(s.head.x, WIDTH), mod(s.head.y, HEIGHT), 3, 0, Math.PI*2);
    bctx.fill();
  }

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
  if(key === 'ArrowUp') { for(const s of snakes) s.speed = Math.min(400, s.speed + 20); }
  if(key === 'ArrowDown') { for(const s of snakes) s.speed = Math.max(30, s.speed - 20); }
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
  // set target angle for all snakes towards tap
  for(const s of snakes){
    const dx = tx - s.head.x, dy = ty - s.head.y;
    s.angle = Math.atan2(dy, dx);
  }
  canvas.focus();
});

// Mobile joystick handling (on-screen joystick for touch devices)
const joystickEl = document.getElementById('joystick');
if(joystickEl){
  const knob = joystickEl.querySelector('.joystick-knob');
  let joyActive = false;
  let joyPointerId = null;
  let joyCenter = {x:0,y:0};
  function resetKnob(){
    knob.style.transition = 'transform 0.12s ease';
    knob.style.transform = 'translate(0,0)';
    setTimeout(()=> knob.style.transition = 'transform 0.06s linear', 140);
  }

  function handleJoyMove(clientX, clientY){
    const dx = clientX - joyCenter.x;
    const dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const max = joystickEl.clientWidth * 0.38; // knob travel radius
    const ratio = Math.min(1, dist / max);
    const nx = (dist > 0) ? (dx / dist) * Math.min(dist, max) : 0;
    const ny = (dist > 0) ? (dy / dist) * Math.min(dist, max) : 0;
    knob.style.transform = `translate(${nx}px, ${ny}px)`;
    // direct-angle control from joystick: apply to all snakes
    const ang = Math.atan2(dy, dx);
    const minSpeed = 60;
    const maxSpeed = 360;
    const sp = Math.max(minSpeed, Math.min(maxSpeed, minSpeed + ratio * (maxSpeed - minSpeed)));
    for(const s of snakes){ s.angle = ang; s.speed = sp; }
    try{ canvas.focus(); }catch(e){}
  }

  joystickEl.addEventListener('pointerdown', e => {
    joystickEl.setPointerCapture(e.pointerId);
    joyActive = true; joyPointerId = e.pointerId;
    const r = joystickEl.getBoundingClientRect();
    joyCenter = { x: r.left + r.width/2, y: r.top + r.height/2 };
    handleJoyMove(e.clientX, e.clientY);
  });

  joystickEl.addEventListener('pointermove', e => {
    if(!joyActive || e.pointerId !== joyPointerId) return;
    handleJoyMove(e.clientX, e.clientY);
  });

  function endJoy(e){
    if(e && e.pointerId !== joyPointerId) return;
    if(e) joystickEl.releasePointerCapture(e.pointerId);
    joyActive = false; joyPointerId = null;
    resetKnob();
  }
  joystickEl.addEventListener('pointerup', endJoy);
  joystickEl.addEventListener('pointercancel', endJoy);
}

startBtn.addEventListener('click', ()=>{ start(); startBtn.blur(); });
pauseBtn.addEventListener('click', ()=>{ running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; });
resetBtn.addEventListener('click', ()=>{ resetGame(); start(); });

// init
resetGame();
requestAnimationFrame(loop);
