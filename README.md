# LyonsZak.com

**An interactive self-portrait of Zak Lyons, senior software engineer** — built as a scroll-driven film. Scrolling is the only control: eight scenes travel through his work and his life, each opened by one of his own photographs given real depth, and a backyard photograph turns into a playable 3D neighborhood he built for his kids. It is a portfolio in the sense that the site itself is the proof of work.

**Live:** [lyonszak.com](https://lyonszak.com) · Source: [github.com/zacharylyonstx/LyonsZakWebsite](https://github.com/zacharylyonstx/LyonsZakWebsite)

---

## Contact

**Zachary "Zak" Lyons** · Senior Software Engineer · Georgetown, TX

- Phone: [512-497-2838](tel:+15124972838)
- Email: [zacharylyonstx@gmail.com](mailto:zacharylyonstx@gmail.com)
- GitHub: [github.com/zacharylyonstx](https://github.com/zacharylyonstx)
- LinkedIn: [linkedin.com/in/zacharylyonstx](https://www.linkedin.com/in/zacharylyonstx)
- Résumé: [`site/public/downloads/zachary-lyons-resume.pdf`](site/public/downloads/zachary-lyons-resume.pdf) — also served at `/resume` on the site
- Contact card: [lyonszak.com/contact](https://lyonszak.com/contact) — a vCard with the photo embedded (`/downloads/zak-lyons.vcf`), one tap to save on a phone

Seven-plus years shipping Django and React/TypeScript products end to end, in regulated domains (crisis telehealth in active ERs, federal ICHRA compliance, post-acquisition healthcare integration) and as a solo founder-engineer. The full history is on the site's `/experience` page.

---

## What the site does

The whole experience is one page and one verb. A damped scroll timeline (17,200px) is divided into eight pixel-weighted chapters; every frame is a pure function of scroll position, so scrubbing anywhere and back produces the identical raster.

| Chapter | What happens |
| --- | --- |
| **The Drummer** | The title frame: a Texas-flag drum portrait with the name set *behind* the subject through a depth-mask occlusion pass. |
| **The Builder** | Kaelbot (an autonomous AI job-search agent, built solo) and MilieuOS as physical panels at dusk; a chat transcript materializes message by message as the panel holds. |
| **The Dad** | Penny and Luke. A sparkler at blue hour, a rope swing — depth-mesh photographs that breathe with the camera. |
| **The Neighborhood** | The signature transition: a real backyard photograph is projected onto the geometry of *Royal Tara Cove*, the family's old cul-de-sac rebuilt as a browser game, and the camera lifts off the photograph into the live world. A visible link plays the real game. |
| **The Band** | Law By The Gun. A frame from the band's music video, the *Lost in Austin* record (a 30-second excerpt on tap, the whole album embedded from Spotify), and band practice with the kids in the room. |
| **TeaSpanks** | Luke sang a line in the HTeaO drive-through; Zak fed it to an AI and asked for metal; the three of them shot a music video. The chapter opens on the lyric as a title card, the frame plays a silent excerpt of itself, one pill plays eighteen seconds of the song, the other opens the real video. |
| **The Weird Ones** | Ghost-hunting hardware he designed and sold (CenTex Paranormal), and a fabricated emergency broadcast playing on a period TV. |
| **The Keeper** | Hand-carved notes to his kids; then day one (2017, the delivery room) dissolving into Penny, then Luke, on his shoulders now. |

Stop-and-interact moments ("pockets") sit inside the film for anyone who wants to go deeper — the game, the music video, the jukebox, the alien-prank clip — and a permanent, quiet fast lane (Resume · Experience · Projects · Contact) is always one click away for anyone who only needs the professional facts. The name in the corner is a contact card: one tap, anywhere in the film, opens the professional headshot, the phone number, and a vCard.

## How it's built

- **Vite + React 19 + TypeScript**, **react-three-fiber / Three.js** for every photographic scene, hand-written **GLSL** for the depth meshes, panel materials, the photo→world crossing shader, and the period TV.
- **Depth-mesh photography:** each hero photograph is paired with a monocular depth map (Depth-Anything-V2) and rendered as a displaced mesh, so a scroll-driven camera gets true parallax from a single still. Type is set *into* the photographs by rendering the foreground again above the display type.
- **The crossing:** projective texturing of a real photograph onto the game world's geometry with hand-authored semantic region masks, a matched camera pose, and a choreographed release — the photograph becomes the world with no visible cut.
- **Determinism as a contract:** a signed inventory (`site/DETERMINISM.md`) of the only three things allowed to differ from `f(scroll, viewport)` (three silent ambient loops, pinned during sweeps), enforced by a byte-level forward/reverse screenshot sweep across the whole journey.
- **Three editions from one codebase:** full WebGL, reduced-motion (composition intact, dissolves only), and no-WebGL (real DOM images placed by the same camera math, real alt text).
- **Accessibility:** Lighthouse 100 (accessibility, best practices, SEO) on the production build; every interactive element keyboard-operable with a visible focus ring and returned focus; pockets are real modal dialogs with a focus trap.
- **Tests:** 298 unit tests (vitest) pin the scene rigs, seams between chapters, envelopes, layout purity, and the segment map against the CSS journey length; `tsc -b` is clean.
- **Phones are a first-class frame:** the film's canvases are sized to the large viewport (`100lvh`) and scroll progress divides by the film's fixed length, so a phone's collapsing toolbar never re-sizes a WebGL buffer or moves the film mid-scroll; touch gets a tighter damping and a lower pixel-ratio cap (`site/src/timeline/filmViewport.ts`).
- **Tooling in the repo:** a Playwright screenshot/byte-sweep harness (`site/scripts/qa.mjs`), a deterministic seek-stepped film recorder (`site/scripts/record-film.mjs`), the asset pipeline (`site/scripts/prepare-assets.mjs`, `grade.mjs`) that grades and stages photographs, depth maps, and loops, and the share-image and headshot/vCard generators (`og-image.mjs`, `og-contact.mjs`, `headshot.mjs`).

## Run it locally

```bash
cd site
npm ci
npm run dev        # http://localhost:5180
```

```bash
npm test           # vitest — 298 tests
npm run build      # production build to site/dist
npx vite preview --port 5180 --strictPort
```

`npm run dev:lan` exposes the dev server on your LAN for a real phone.

## Layout

```
site/
  index.html, resume.html, experience.html, projects.html, contact.html, 404.html
  src/
    App.tsx              the shell: canvas, fast lane, scene mounts
    timeline/            the damped scroll timeline and the pixel-weighted segment map
    film/                the voice-line inventory and the subtitle layer
    scenes/              one directory per chapter: a pure "rig" (math) + a scene (render)
    crossing/            the photo→world engine (loader, depth mesh, shader, choreography)
    world-rtc/           the Royal Tara Cove world (houses, props, vegetation, cine camera)
    pockets/             the stop-and-interact dialogs and their content
    contact/             the contact card (the headshot, the facts, the vCard door)
    audio/               the opt-in ambient bed and the sound toggle
  public/                every asset the film ships (graded photos, depth maps, models, loops)
  scripts/               qa harness, film recorder, asset pipeline
  DETERMINISM.md         the determinism contract
netlify.toml             build: site/ → site/dist
```

## Credits

Photographs, video, and recordings are Zak's own. *Lost in Austin* and *One Song Town* © Law By The Gun. Fonts: Bricolage Grotesque and Newsreader (SIL Open Font License; see `site/public/fonts/ATTRIBUTION.md`). World models: see `site/src/world-rtc/ATTRIBUTION.md`.

© Zachary Lyons. The code is shared for reading and reference; the photographs, video, audio, and likenesses are not licensed for reuse.
