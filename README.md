# Snake — Minimal Web Game

Files created:

- `index.html` — main page with canvas and controls
- `style.css` — styling
- `script.js` — game logic

How to run

1. Open `index.html` directly in your browser (double-click or open file).

2. Or start a simple HTTP server from the `snake` folder (recommended for some browsers):

```bash
cd /root/snake
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Controls

- Arrow keys or WASD to move
- `Start`, `Pause/Resume`, `Restart` buttons provided
- Touch: swipe on canvas to change direction

Notes

- The game stores a simple high-score in `localStorage`.
- The canvas uses a fixed size; responsive scaling is applied for small screens.
