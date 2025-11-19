# Snake — Minimal Web Game

Files

- `index.html` — main page with the game canvas, score, and controls
- `style.css` — layout and visual styles
- `script.js` — game logic and rendering

Features

- Smooth, continuous (pixel) movement with angle-based turning (no tile grid)
- Responsive controls: keyboard, touch, and UI buttons
- Special food: **shrooms** — give score/length and trigger a colorful RGB overlay
- Distortion: a wavy screen distortion is applied while the shroom effect is active
- High score persists in `localStorage`

Controls

- `ArrowLeft` / `A`: turn left (angle)
- `ArrowRight` / `D`: turn right (angle)
- `ArrowUp` / `W`: increase speed (temporary)
- `ArrowDown` / `S`: decrease speed
- `Space`: pause / resume game
- Touch: tap the canvas to aim toward the tap; swipe/drag also adjusts direction
- Buttons: `Start`, `Pause/Resume`, `Restart`

How to run (local)

1. From the project folder, run a simple HTTP server (recommended for consistent behavior):

```bash
cd /root/snake
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

2. You can also open `index.html` directly in some browsers, but local server is preferred.

GitHub Pages (deployed)

This project is published via GitHub Pages at:

`https://hensingmira-pixel.github.io/snake/`

Quick deploy steps (if you maintain the repo locally):

```bash
# commit your changes
git add -A
git commit -m "Update: features / distortion"
# push to the gh-pages branch (this project serves from gh-pages)
git push origin gh-pages
```

Troubleshooting & tips

- If changes don't appear in your browser, do a hard refresh (Ctrl+Shift+R) or clear cache. The game code sometimes uses a cache-busting query (e.g. `script.js?v=4`) but browser cache can still keep old assets.
- The shroom visual effect is intentionally strong; if it appears too intense for you, I can reduce the blur/alpha or shorten the duration.
- If the page scrolls when using arrow keys, click/tap the canvas first (it's focusable) — the code prevents default page scrolling when the canvas is focused.

Development notes

- The main rendering now draws the scene into an offscreen buffer and applies a wavy slice-based distortion to the visible canvas while the shroom effect is active. This keeps the distortion fast and avoids per-pixel operations.
- High score is stored under the `localStorage` key `snake_high`.

License / Credits

- Minimal demo built with vanilla HTML/CSS/JS. Feel free to fork and iterate.
