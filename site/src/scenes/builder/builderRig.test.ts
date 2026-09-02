// Contract tests for THE BUILDER's rig. Pins:
//   frames = f(scroll)        -> purity / determinism
//   exact handoff from THE DRUMMER -> zero-jump camera continuity at
//                                     t = BUILDER_START
//   the scene ends cleanly    -> fully dissolved before THE DAD, camera
//                                 lands at a documented, near-neutral pose
//   no caption/subtitle collision -> the museum labels never enter the
//                                 global lower-third's screen band, at any
//                                 journey position or viewport this test
//                                 samples (docs/v2-direction.md's law that
//                                 the plate-yield system is global — this is
//                                 the "confirm no collision" check made a
//                                 test instead of a one-time eyeball)
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { cameraPose as drummerCameraPose, REST_Z } from '../drummer/drummerRig';
import {
  BUILDER_END,
  PANEL_SPECS,
  anyPanelVisible,
  cameraPose,
  captionAnchor,
  isPortrait,
  panelCorner,
  panelLayout,
  panelOpacity,
  panelTopAnchor,
  projectPoint,
  sceneActive,
  type CameraPose,
  type PanelId,
} from './builderRig';

const [START, END] = SEGMENTS.builder;
const PANELS: PanelId[] = ['kaelbot', 'milieuos'];

describe('handoff from THE DRUMMER', () => {
  it('cameraPose(BUILDER_START) is byte-identical to drummerRig.cameraPose(BUILDER_START)', () => {
    expect(cameraPose(START)).toEqual(drummerCameraPose(START, false));
  });

  it('stays within float noise just inside the segment (p~0 collapses drift/exit to ~zero)', () => {
    const got = cameraPose(START + 1e-9);
    const want = drummerCameraPose(START, false);
    expect(got.x).toBeCloseTo(want.x, 9);
    expect(got.y).toBeCloseTo(want.y, 9);
    expect(got.z).toBeCloseTo(want.z, 9);
  });

  it('reduced motion pins the camera at the site-wide rest pose, matching THE DRUMMER', () => {
    expect(cameraPose(START, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose((START + END) / 2, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose(END, true)).toEqual(drummerCameraPose(START, true));
  });
});

describe('camera purity + range', () => {
  it('is a pure function of t', () => {
    const a = cameraPose(0.18);
    const b = cameraPose(0.18);
    expect(a).toEqual(b);
  });

  it('never crosses either panel plane (camera.z always > panel.z)', () => {
    for (let t = START; t <= END + 0.02; t += 0.005) {
      const cam = cameraPose(t);
      expect(cam.z).toBeGreaterThan(PANEL_SPECS.kaelbot.z);
      expect(cam.z).toBeGreaterThan(PANEL_SPECS.milieuos.z);
    }
  });

  it('BUILDER_END is the documented, near-neutral pose for Scene 3', () => {
    expect(BUILDER_END.x).toBeCloseTo(0, 5);
    expect(BUILDER_END.z).toBeGreaterThan(PANEL_SPECS.kaelbot.z + 1); // clear margin
  });
});

describe('sceneActive', () => {
  it('is false before the segment and true at its exact start', () => {
    expect(sceneActive(START - 0.001)).toBe(false);
    expect(sceneActive(START)).toBe(true);
  });

  it('stays true through a short tail past the segment end, then false', () => {
    expect(sceneActive(END)).toBe(true);
    expect(sceneActive(END + 0.019)).toBe(true);
    expect(sceneActive(END + 0.05)).toBe(false);
  });
});

describe('panelOpacity', () => {
  it.each(PANELS)('%s is 0 well outside the segment', (id) => {
    expect(panelOpacity(id, 0)).toBe(0);
    expect(panelOpacity(id, 1)).toBe(0);
  });

  it.each(PANELS)('%s rises to fully opaque and back down, never negative or >1', (id) => {
    const spec = PANEL_SPECS[id];
    const span = END - START;
    let sawFull = false;
    let prevRising = -1;
    for (let p = 0; p <= 1.1; p += 0.002) {
      const t = START + p * span;
      const o = panelOpacity(id, t);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      if (o >= 0.999) sawFull = true;
      // strictly monotonic only through the rise (p up to its own fadeInEnd)
      if (p <= spec.fadeInEnd) {
        expect(o).toBeGreaterThanOrEqual(prevRising - 1e-9);
        prevRising = o;
      }
    }
    expect(sawFull).toBe(true);
  });

  it('kaelbot lingers past milieuos (fades out later)', () => {
    expect(PANEL_SPECS.kaelbot.fadeOutEnd).toBeGreaterThan(PANEL_SPECS.milieuos.fadeOutEnd);
  });
});

describe('anyPanelVisible', () => {
  it('matches whichever panel has opacity outside the segment', () => {
    expect(anyPanelVisible(0)).toBe(false);
    expect(anyPanelVisible((START + END) / 2)).toBe(true);
  });
});

describe('panelLayout', () => {
  const DESKTOP = { w: 1600, h: 1000 };
  const PORTRAIT = { w: 390, h: 844 };

  it('is a pure function of viewport, independent of t', () => {
    const a = panelLayout('kaelbot', DESKTOP.w, DESKTOP.h);
    const b = panelLayout('kaelbot', DESKTOP.w, DESKTOP.h);
    expect(a).toEqual(b);
  });

  it('kaelbot (nearer) renders larger than milieuos (further) at the same viewport', () => {
    const kb = panelLayout('kaelbot', DESKTOP.w, DESKTOP.h);
    const mo = panelLayout('milieuos', DESKTOP.w, DESKTOP.h);
    expect(kb.height).toBeGreaterThan(mo.height);
  });

  it('matches the manual worldPerPx formula', () => {
    const spec = PANEL_SPECS.kaelbot;
    const halfFovRad = (38 * Math.PI) / 360;
    const wpp = (2 * (REST_Z - spec.z) * Math.tan(halfFovRad)) / DESKTOP.h;
    const expectedHeight = spec.screenHeightFrac * DESKTOP.h * wpp;
    const lay = panelLayout('kaelbot', DESKTOP.w, DESKTOP.h);
    expect(lay.height).toBeCloseTo(expectedHeight, 9);
    expect(lay.width).toBeCloseTo(expectedHeight * spec.aspect, 9);
  });

  it('switches to the portrait composition (stacked) below the landscape threshold', () => {
    expect(isPortrait(DESKTOP.w, DESKTOP.h)).toBe(false);
    expect(isPortrait(PORTRAIT.w, PORTRAIT.h)).toBe(true);
    const kbLandscape = panelLayout('kaelbot', DESKTOP.w, DESKTOP.h);
    const kbPortrait = panelLayout('kaelbot', PORTRAIT.w, PORTRAIT.h);
    // different composition targets -> different world Y at minimum
    expect(kbPortrait.y).not.toBeCloseTo(kbLandscape.y, 3);
  });

  it('portrait stacks kaelbot above milieuos (screen space)', () => {
    const kb = panelLayout('kaelbot', PORTRAIT.w, PORTRAIT.h);
    const mo = panelLayout('milieuos', PORTRAIT.w, PORTRAIT.h);
    // larger world Y = higher on screen (screen-space y = h/2 - worldY/wpp)
    expect(kb.y).toBeGreaterThan(mo.y);
  });
});

describe('projectPoint', () => {
  it('places a straight-ahead point at rest exactly at screen center', () => {
    const p = projectPoint({ x: 0, y: 0, z: REST_Z - 4 }, { x: 0, y: 0, z: REST_Z }, 1600, 1000);
    expect(p.x).toBeCloseTo(800, 6);
    expect(p.y).toBeCloseTo(500, 6);
    expect(p.depth).toBeCloseTo(4, 6);
  });

  it('is a pure function of its inputs', () => {
    const world = { x: 0.3, y: -0.1, z: 0.5 };
    const cam = { x: -0.1, y: 0.05, z: 3 };
    expect(projectPoint(world, cam, 1600, 1000)).toEqual(projectPoint(world, cam, 1600, 1000));
  });
});

describe('caption anchors never collide with the global subtitle lower-third', () => {
  // subtitle-layer sits at bottom: clamp(52px, 9vh, 96px) with multi-line
  // italic text above it — reserve the bottom ~22% of the viewport as its
  // exclusion band, at every sampled journey position and viewport.
  const VIEWPORTS = [
    { w: 1600, h: 1000 },
    { w: 2200, h: 1238 },
    { w: 390, h: 844 },
    { w: 428, h: 926 },
  ];

  it.each(VIEWPORTS)('%o keeps both captions above the subtitle band', ({ w, h }) => {
    const subtitleBandTop = h * 0.78;
    for (let t = START; t <= END + 0.02; t += 0.004) {
      const cam = cameraPose(t);
      for (const id of PANELS) {
        if (panelOpacity(id, t) <= 0.0005) continue; // invisible, can't collide
        const anchor = captionAnchor(id, w, h);
        const screen = projectPoint(anchor, cam, w, h);
        expect(screen.y).toBeLessThan(subtitleBandTop);
      }
    }
  });
});

describe('portrait: kaelbot never overlaps milieuos below it', () => {
  // The stacked-vertical composition only exists at narrow/tall viewports —
  // check the caption (kaelbot's lowest visible pixel) against milieuos's
  // own top-with-glow edge, across the segment and a couple of portrait
  // sizes. An early build had these two panels overlapping AT REST, before
  // camera drift ever got involved — this is the regression guard for that.
  const PORTRAITS = [
    { w: 390, h: 844 },
    { w: 428, h: 926 },
    { w: 360, h: 780 },
  ];

  it.each(PORTRAITS)('%o keeps a gap between kaelbot and milieuos', ({ w, h }) => {
    for (let t = START; t <= END + 0.02; t += 0.004) {
      const cam = cameraPose(t);
      if (panelOpacity('kaelbot', t) <= 0.0005 || panelOpacity('milieuos', t) <= 0.0005) {
        continue;
      }
      const kaelbotBottom = projectPoint(captionAnchor('kaelbot', w, h), cam, w, h);
      const milieuosTop = projectPoint(panelTopAnchor('milieuos', w, h), cam, w, h);
      expect(kaelbotBottom.y).toBeLessThan(milieuosTop.y);
    }
  });
});

describe('panels (and their glow) never overlap the permanent fast lane', () => {
  // .fastlane's own content + gradient runs roughly 90-110px tall before
  // fully fading at any of these viewports (padding 20-44px + ~34-50px of
  // text) — reserve a flat 120px band, matching the caption test's
  // construction-time guard rather than a one-time eyeball.
  const VIEWPORTS = [
    { w: 1600, h: 1000 },
    { w: 2200, h: 1238 },
    { w: 390, h: 844 },
    { w: 428, h: 926 },
  ];
  const FASTLANE_BAND = 120;

  it.each(VIEWPORTS)('%o keeps both panels (incl. glow) below the fast lane', ({ w, h }) => {
    for (let t = START; t <= END + 0.02; t += 0.004) {
      const cam = cameraPose(t);
      for (const id of PANELS) {
        if (panelOpacity(id, t) <= 0.0005) continue;
        const top = panelTopAnchor(id, w, h);
        const screen = projectPoint(top, cam, w, h);
        expect(screen.y).toBeGreaterThan(FASTLANE_BAND);
      }
    }
  });
});

/** A panel's on-screen bounding box through the LIVE camera, from its four
 *  corners (see panelCorner's doc comment). */
function screenBBox(id: PanelId, cam: CameraPose, w: number, h: number) {
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ].map(([lx, ly]) => projectPoint(panelCorner(id, w, h, lx, ly), cam, w, h));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

describe('MilieuOS stays wholly inside the frame (scene2-report.md Finding 1)', () => {
  // The taste-gate finding: at rest (t≈0.140) AND mid-drift (t≈0.190) the
  // brightest object in the frame was clipped by the right viewport edge —
  // a half-amputated bright card. Fixed by recomposing milieuos smaller and
  // shifted left (builderRig.ts). This samples the segment's own CORE
  // (where the finding required wholeness, not the entry/exit transitions
  // where partial-frame is explicitly allowed) at both desktop viewports
  // named in the finding.
  const VIEWPORTS = [
    { w: 1600, h: 1000 },
    { w: 1280, h: 800 },
  ];
  // The segment CORE, held at the same LOCAL fractions the finding was
  // verified at (0.125..2/3 of the segment — journey-absolute 0.135..0.20
  // under the original [0.12, 0.24] bounds) so the guard keeps meaning
  // "the core, where wholeness is required" across segment retunes
  // (integration pass 2026-08-30: bounds moved to [0.10, 0.20]).
  const CORE_START = SEGMENTS.builder[0] + 0.125 * (SEGMENTS.builder[1] - SEGMENTS.builder[0]);
  const CORE_END = SEGMENTS.builder[0] + (2 / 3) * (SEGMENTS.builder[1] - SEGMENTS.builder[0]);

  it.each(VIEWPORTS)('%o: milieuos never crosses the right (or left) viewport edge', ({ w, h }) => {
    for (let t = CORE_START; t <= CORE_END; t += 0.005) {
      const cam = cameraPose(t);
      const box = screenBBox('milieuos', cam, w, h);
      expect(box.right).toBeLessThan(w);
      expect(box.left).toBeGreaterThan(0);
    }
  });

  it.each(VIEWPORTS)('%o: milieuos never overlaps kaelbot on screen', ({ w, h }) => {
    for (let t = CORE_START; t <= CORE_END; t += 0.005) {
      const cam = cameraPose(t);
      const kaelbot = screenBBox('kaelbot', cam, w, h);
      const milieuos = screenBBox('milieuos', cam, w, h);
      const overlapsX = kaelbot.left < milieuos.right && milieuos.left < kaelbot.right;
      const overlapsY = kaelbot.top < milieuos.bottom && milieuos.top < kaelbot.bottom;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });
});

describe('both panels stay wholly inside the portrait frame (Finding 1, "re-check portrait")', () => {
  // The finding explicitly calls out re-checking the stacked portrait
  // composition too. At portraitXFrac 0.5 (geometric center) BOTH panels'
  // own crisp edges ran past the viewport's right edge through the segment
  // core — the shared BUILDER camera carries persistent leftward x-drift
  // (present from THE DRUMMER's own exit pose onward) that pushes screen
  // content right in every orientation, not just landscape. This is the
  // portrait-specific regression guard, sampling the same three portrait
  // sizes the existing "kaelbot never overlaps milieuos below it" suite
  // uses, over the same segment core as the landscape suite above.
  const VIEWPORTS = [
    { w: 390, h: 844 },
    { w: 428, h: 926 },
    { w: 360, h: 780 },
  ];
  // The segment CORE, held at the same LOCAL fractions the finding was
  // verified at (0.125..2/3 of the segment — journey-absolute 0.135..0.20
  // under the original [0.12, 0.24] bounds) so the guard keeps meaning
  // "the core, where wholeness is required" across segment retunes
  // (integration pass 2026-08-30: bounds moved to [0.10, 0.20]).
  const CORE_START = SEGMENTS.builder[0] + 0.125 * (SEGMENTS.builder[1] - SEGMENTS.builder[0]);
  const CORE_END = SEGMENTS.builder[0] + (2 / 3) * (SEGMENTS.builder[1] - SEGMENTS.builder[0]);

  it.each(VIEWPORTS)('%o keeps both panels between the left and right edges', ({ w, h }) => {
    for (let t = CORE_START; t <= CORE_END; t += 0.005) {
      const cam = cameraPose(t);
      for (const id of PANELS) {
        const box = screenBBox(id, cam, w, h);
        expect(box.right).toBeLessThan(w);
        expect(box.left).toBeGreaterThan(0);
      }
    }
  });
});
