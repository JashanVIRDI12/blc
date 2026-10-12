# Homepage performance — 12 October 2026

The hero showroom film and the lights-on collection retain their existing
design and model assets. The optimization started in commit `61ba713` and
was completed with the headline-clearance fix, repeatable browser check,
production fallback checks and this report.

## What changed

- The hero renders its inspection shots behind the loader, including the
  bonnet, cabin, lamp glows and headline textures. First-use GPU work happens
  before the visitor scrolls to those shots.
- The collection downloads ahead, prepares one car at a time, uploads
  textures in batches and compiles programs for the HDR render target they
  actually use. Geometry and driver pipelines are rehearsed in small batches
  with GPU fences between them. About loads after the collection.
- `src/idle.js` yields background preparation between frames and waits for
  quiet periods before heavier steps. Work can proceed sooner as its section
  approaches, so preparation does not wait indefinitely for a visitor to stop.
- `src/area-lights.js` shares the view and roughness calculations between area
  lights, skips lights that are off and avoids diffuse integration for pure
  metals. Its replacement is guarded against incompatible Three.js chunks.
- The collection keeps its render density, HDR and SMAA while moving. At rest
  it adds MSAA. Phones retain MSAA throughout. The full multisampled render
  target is released between still frames; moving frames reuse the floor
  reflection on alternate draws. Model geometry and texture dimensions stay
  unchanged.
- Static portions of the collection timeline reuse their last picture.
  Hidden film captions avoid repeated identical style writes. Dust starts
  after the page settles, uses smaller canvases and pauses off screen.
- The wall logo moved from x = 6.3 m to x = 7.5 m, clearing the opening
  headline through the initial camera move. The existing geometry test now
  passes without weakening its clearance requirement.

## Local measurements

These are requestAnimationFrame gaps during a continuous scroll through the
hero, collection and back. Lower is better; 16.7 ms corresponds to 60 Hz.
Screenshots were captured in separate runs. The raw summaries are in
[home-performance.json](home-performance.json).

| Browser / build | Hero average | Collection average | Collection p95 | Reverse average |
| --- | ---: | ---: | ---: | ---: |
| Chrome 154, original | 20.0 ms | 25.1 ms | 49.9 ms | 19.6 ms |
| Chrome 154, updated | 16.8 ms | 16.8 ms | 16.7 ms | 17.0 ms |
| Firefox 157, original | 23.0 ms | 19.9 ms | 33.3 ms | 17.8 ms |
| Firefox 157, updated | 17.3 ms | 17.0 ms | 17.0 ms | 16.8 ms |
| Chrome, emulated phone, updated | 17.0 ms | 16.7 ms | 16.7 ms | 16.7 ms |

Desktop traces used 1440 × 820 CSS pixels at DPR 2 and began scrolling four
seconds after the loader cleared. The phone trace used 390 × 844 at DPR 3
(rendering at 2×), disabled the HTTP cache and began after 600 ms. Its
collection was still preparing at the end of the hero; the stills remained
available until all four cars were ready. Readiness, reversal and overflow
checks passed, with no uncaught browser exceptions.

The updated Chrome desktop forward scroll had no JavaScript long tasks;
its largest frame gap in either forward segment was 66.7 ms. Firefox's largest
forward gap was 83.3 ms. The phone had no gaps above 50 ms during the forward
or reverse scroll. A 116.7 ms gap remained in Chrome's reverse trace. Firefox
also recorded a 566.7 ms gap during background preparation before scrolling
started. Near-60-fps averages do not mean every frame meets its budget.

These are single local headless traces on this Mac with GPU acceleration,
not measurements from physical phones or Safari. Browser/driver shader caches
were not reset between comparisons; loader timings should not be interpreted
as controlled cold-load benchmarks. First visits and slower devices can still
pause during preparation. The target is smooth interaction at the existing
visual quality, not a universal frame-rate guarantee.

## Verification and repetition

`npm test` passes all 45 tests. `npm run build` succeeds; Vite retains its
existing warning for the Three.js chunk. A separate browser review checks
desktop and phone composition, full-quality settling, normal production load,
reduced motion with no GLB downloads, WebGL unavailability and context loss.

Start a GPU-enabled Chrome debugging instance and Vite, then run:

```sh
FORMA_CDP_URL=http://127.0.0.1:9222 npm run check:home -- http://127.0.0.1:5174
FORMA_CDP_URL=http://127.0.0.1:9222 WAIT=600 npm run check:home -- http://127.0.0.1:5174 --mobile --cold-network
```

For a bundled measurement, build with `NODE_ENV=development npx vite build
--outDir /tmp/baba-perf`, then serve that directory with Vite preview. The
development environment keeps the scene inspection hooks in the bundled code;
the normal production build omits them. Set `BLC_PERF_REPORT` to save a JSON
report and `W`, `H`, `DSF` or `WAIT` to vary the viewport or initial pause.
The checker records timings, then verifies all four collection cars, the full
rendering path after settling, body/wheel/door restoration when scrolling
back, horizontal overflow and uncaught exceptions. It does not submit forms.

The snapshot's `quality.quick` describes whether a quick rendering path exists.
`rendering.quick` describes the frame actually drawn; after settling,
`rendering.fullReady` is true and `rendering.quick` is false.

## Research applied

[web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
explains why separate functions alone do not yield to input or rendering;
work must continue in separate tasks. The loading scheduler uses frame and
timer boundaries between preparation steps.

[Three.js: WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync)
documents configuring the scene's lighting/environment before compilation and
the parallel shader compile extension used by `compileAsync`. The collection
compiles against its actual scene and target, then rehearses draws and waits
on GPU fences to cover work compilation alone does not prepare.

[GSAP: ScrollTrigger tips and mistakes](https://gsap.com/resources/st-mistakes/)
describes how pin creation order and layout changes affect trigger positions.
The film, collection and About pins remain ordered, and refresh/layout work is
kept out of the frame-by-frame scroll path.
