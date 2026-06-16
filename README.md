# about-me

A personal page — a 3D sphere tiled with the cover of *Loveless* (My Bloody Valentine),
spinning and reacting to the music, in the album's washed-pink shoegaze palette.

Built with [three.js](https://threejs.org/) (WebGL) + the Web Audio API. No build step —
it's a static site.

## Run locally

```bash
python -m http.server 5500
# then open http://localhost:5500/
```

> Serve it over HTTP, not `file://` — the ES-module imports and the audio analyser
> both require it.

## Add your assets

Drop these two files into `assets/` (see `assets/README.txt`):

- `loveless.jpg` — the album cover art (square, ~1000×1000)
- `loveless.mp3` — the audio track (loops; fades in from low to full)

Until then the page shows a pink placeholder cover and runs silently.

## Edit your info

In `index.html`: your name, and the last.fm / spotify links.

## Tuning

Knobs live at the top of `main.js` (`SPIN_SPEED`, fade timing) and in the
cover-sphere block (`FACE_GRID` = covers per cube-face, reflection settings).
