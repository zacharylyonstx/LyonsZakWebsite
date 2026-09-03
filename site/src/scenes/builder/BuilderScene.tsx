// Scene 2 — THE BUILDER. Two real screens (Kaelbot, MilieuOS) as textured
// planes at different world depths, floating in the dusk THE DRUMMER's exit
// breath opens onto. The camera (the SAME camera/Canvas THE DRUMMER drives)
// continues its push and pan; because the panels never move and sit at
// different distances from it, the camera's own translation is what
// produces real parallax between them — no per-panel animation needed (see
// builderRig.ts's file header).
//
// Rendering stack (bottom to top, same Canvas as THE DRUMMER, z1 .stage):
//   glow sprite   — a soft amber radial gradient, additive, behind each
//                   panel, bleeding past its edges (the "screen glow
//                   spilling into the dusk" — cheap CanvasTexture, no
//                   postprocessing bloom pass).
//   reflection    — a short, blurred color echo of the panel's own bottom
//                   edge just below it (the "whisper of reflection" — a
//                   downsampled abstraction, never legible text, so it
//                   can't be mistaken for a rendering bug).
//   panel         — the crisp screenshot itself, edge-feathered
//                   (panelMaterial.ts) so it melts into its own glow rather
//                   than reading as a pasted rectangle.
//
// DOM captions (BuilderCaptions, mounted as a sibling of NameCard in
// App.tsx, NOT inside the Canvas) track each panel's projected screen
// position every frame via builderRig's projectPoint — the museum-label
// move that separates this from a floating caption: the label rides WITH
// its panel through the same parallax, because it's driven by the identical
// pure functions.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BUILDER_END,
  FOV_DEG,
  GLOW_SCALE,
  PANEL_SPECS,
  REST_Z,
  cameraPose,
  captionAnchor,
  panelLayout,
  panelOpacity,
  projectPoint,
  sceneActive,
  type PanelId,
} from './builderRig';
import {
  blurredReflectionTexture,
  glowTexture,
  loadPanelTexture,
  makeChatPatchMaterial,
  makePanelMaterial,
  reflectionAlphaTexture,
  type ChatPatchHandle,
  type PanelMaterialHandle,
} from './panelMaterial';
import {
  CHAT_MESSAGES,
  anyChatPatchVisible,
  chatPatchUrl,
  messageReveal,
  messageUvRect,
  patchOpacity,
} from './chatReveal';
import { builderProgress } from './builderRig';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { filmHeight } from '../../timeline/filmViewport';

export { BUILDER_END };

const PANEL_URLS: Record<PanelId, string> = {
  kaelbot: '/assets/builder/kaelbot.jpg',
  milieuos: '/assets/builder/milieuos.jpg',
};

const CAPTION_TEXT: Record<PanelId, string> = {
  kaelbot: 'KAELBOT — kaelbot.com, 2026',
  milieuos: 'MILIEUOS — healthcare operations, 2026',
};

/** Fraction of the panel's own height its reflection echoes below it — see
 *  panelMaterial.ts's blurredReflectionTexture for why this is a downsampled
 *  blur of that slice, never a crisp mirrored duplicate. */
const REFLECTION_SLICE = 0.22;

interface PanelRig {
  group: THREE.Group;
  panel: PanelMaterialHandle;
  glow: THREE.Mesh;
  reflection: THREE.Mesh;
  reflectionTexture: THREE.Texture;
  /** Chat-reveal cover patches (kaelbot only — chatReveal.ts). */
  chatPatches: { mesh: THREE.Mesh; handle: ChatPatchHandle }[];
}

/** The nine chat cover patches, parented to the kaelbot panel MESH so they
 *  inherit its per-frame scale — each is a unit plane at its message's
 *  panel-uv rect, a hair in front of the panel (renderOrder 3 > panel's 2;
 *  z epsilon is cosmetic only, both materials skip depth writes). */
function buildChatPatches(
  panelMesh: THREE.Mesh,
  textures: THREE.Texture[],
): { mesh: THREE.Mesh; handle: ChatPatchHandle }[] {
  return textures.map((tex, i) => {
    const uv = messageUvRect(i);
    const handle = makeChatPatchMaterial(tex, {
      minU: uv.centerU - uv.sizeU / 2,
      minV: uv.centerV - uv.sizeV / 2,
      sizeU: uv.sizeU,
      sizeV: uv.sizeV,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
    mesh.position.set(uv.centerU - 0.5, uv.centerV - 0.5, 0.002);
    mesh.scale.set(uv.sizeU, uv.sizeV, 1);
    mesh.renderOrder = 3;
    mesh.visible = false;
    panelMesh.add(mesh);
    return { mesh, handle };
  });
}

function buildPanelRig(texture: THREE.Texture, chatTextures?: THREE.Texture[]): PanelRig {
  const group = new THREE.Group();

  const reflectionTexture = blurredReflectionTexture(
    texture.image as TexImageSource,
    REFLECTION_SLICE,
  );

  const reflectionGeom = new THREE.PlaneGeometry(1, 1);
  const reflection = new THREE.Mesh(
    reflectionGeom,
    new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      alphaMap: reflectionAlphaTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  reflection.renderOrder = 0;

  const glowGeom = new THREE.PlaneGeometry(1, 1);
  const glow = new THREE.Mesh(
    glowGeom,
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      // NOT additive: this Canvas clears to transparent (alpha 0) so the
      // DOM dusk gradient shows through underneath it, and additive
      // blending's own alpha handling leaves the canvas's OWN output alpha
      // too low for the browser's subsequent DOM composite step to carry
      // much color forward — the glow all but vanished against the dusk
      // until this was normal (alpha) blending instead, which writes a
      // real, visible alpha into the canvas itself.
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  glow.renderOrder = 1;

  const panelGeom = new THREE.PlaneGeometry(1, 1);
  const panel = makePanelMaterial(texture);
  const panelMesh = new THREE.Mesh(panelGeom, panel.material);
  panelMesh.renderOrder = 2;

  group.add(reflection, glow, panelMesh);
  const chatPatches = chatTextures ? buildChatPatches(panelMesh, chatTextures) : [];
  return { group, panel, glow, reflection, reflectionTexture, chatPatches };
}

function disposePanelRig(rig: PanelRig): void {
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
  rig.reflectionTexture.dispose();
}

/** The WebGL half — mounts inside App's main Canvas (z1), alongside
 *  DrummerPhotoLayer. */
export function BuilderPanels({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const [textures, setTextures] = useState<{
    kaelbot: THREE.Texture;
    milieuos: THREE.Texture;
    chat: THREE.Texture[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    Promise.all([
      loadPanelTexture(PANEL_URLS.kaelbot, maxAniso),
      loadPanelTexture(PANEL_URLS.milieuos, maxAniso),
      Promise.all(
        CHAT_MESSAGES.map((m) => loadPanelTexture(chatPatchUrl(m.id), maxAniso)),
      ),
    ]).then(([kaelbot, milieuos, chat]) => {
      if (alive) setTextures({ kaelbot, milieuos, chat });
    });
    return () => {
      alive = false;
    };
  }, [gl]);

  const rigs = useMemo(() => {
    if (!textures) return null;
    return {
      kaelbot: buildPanelRig(textures.kaelbot, textures.chat),
      milieuos: buildPanelRig(textures.milieuos),
    } satisfies Record<PanelId, PanelRig>;
  }, [textures]);

  useEffect(() => {
    if (!rigs) return;
    return () => {
      disposePanelRig(rigs.kaelbot);
      disposePanelRig(rigs.milieuos);
    };
  }, [rigs]);

  useFrame(({ camera, size }) => {
    if (!rigs) return;
    const t = timeline.value();

    if (!sceneActive(t)) {
      rigs.kaelbot.group.visible = false;
      rigs.milieuos.group.visible = false;
      return;
    }
    rigs.kaelbot.group.visible = true;
    rigs.milieuos.group.visible = true;

    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const pc = camera as THREE.PerspectiveCamera;
      if (pc.fov !== 38) {
        pc.fov = 38;
        pc.updateProjectionMatrix();
      }
    }

    (Object.keys(rigs) as PanelId[]).forEach((id) => {
      const rig = rigs[id];
      const lay = panelLayout(id, size.width, size.height);
      const opacity = panelOpacity(id, t);

      rig.group.position.set(lay.x, lay.y, lay.z);
      rig.group.rotation.y = lay.rotY;

      // panel (child 2): unit plane scaled to its computed world size.
      const panelMesh = rig.group.children[2] as THREE.Mesh;
      panelMesh.scale.set(lay.width, lay.height, 1);
      rig.panel.setOpacity(opacity);

      // glow (child 1): larger than the panel, sits slightly further from
      // the camera so it bleeds past the panel's own feathered edge.
      rig.glow.position.z = -0.08;
      rig.glow.scale.set(lay.width * GLOW_SCALE, lay.height * GLOW_SCALE, 1);
      (rig.glow.material as THREE.MeshBasicMaterial).opacity = opacity * 0.95;

      // reflection (child 0): a short, flipped echo hugging the bottom
      // edge — scale.y negative flips V so the content nearest the panel's
      // own bottom edge (the cloned texture's sliced UV range) is what
      // touches the mirror line (see file header + panelMaterial.ts's
      // reflectionAlphaTexture doc comment for the full V-mapping chain).
      const reflHeight = lay.height * REFLECTION_SLICE;
      rig.reflection.position.set(0, -lay.height / 2 - reflHeight / 2, -0.02);
      rig.reflection.scale.set(lay.width, -reflHeight, 1);
      (rig.reflection.material as THREE.MeshBasicMaterial).opacity = opacity * 0.16;
    });

    // Chat reveal (chatReveal.ts): each cover patch dissolves as its
    // message's window opens; past CHAT_REVEAL_DONE_P every quad is
    // visible=false and the render equals the pre-feature frame exactly.
    const anyPatch = anyChatPatchVisible(t);
    const p = builderProgress(t);
    rigs.kaelbot.chatPatches.forEach((patch, i) => {
      const op = anyPatch ? patchOpacity(i, t) : 0;
      if (op <= 0.0005) {
        patch.mesh.visible = false;
        return;
      }
      patch.mesh.visible = true;
      patch.handle.setOpacity(op);
      patch.handle.setReveal(messageReveal(i, p));
    });
  });

  return (
    <>
      {rigs && <primitive object={rigs.kaelbot.group} />}
      {rigs && <primitive object={rigs.milieuos.group} />}
    </>
  );
}

/** The DOM half — the two museum-label captions, each tracking its panel's
 *  live projected screen position (parallax and all) every frame. Mounted
 *  as a sibling of NameCard, not inside the Canvas. */
export function BuilderCaptions({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const kaelbotRef = useRef<HTMLParagraphElement>(null);
  const milieuosRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!timeline) return;
    const refs: Record<PanelId, React.RefObject<HTMLParagraphElement | null>> = {
      kaelbot: kaelbotRef,
      milieuos: milieuosRef,
    };
    const apply = (value: number) => {
      const w = window.innerWidth;
      const h = filmHeight();
      const cam = cameraPose(value, reducedMotion);
      (Object.keys(refs) as PanelId[]).forEach((id) => {
        const el = refs[id].current;
        if (!el) return;
        const opacity = panelOpacity(id, value);
        if (opacity <= 0.0005) {
          el.style.opacity = '0';
          return;
        }
        const anchor = captionAnchor(id, w, h);
        const screen = projectPoint(anchor, cam, w, h);
        el.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
        el.style.opacity = opacity.toFixed(4);
      });
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  return (
    <>
      <p ref={kaelbotRef} className="panel-caption" aria-hidden="true">
        {CAPTION_TEXT.kaelbot}
      </p>
      <p ref={milieuosRef} className="panel-caption" aria-hidden="true">
        {CAPTION_TEXT.milieuos}
      </p>
    </>
  );
}

/** No-WebGL branch: the two crops as plain, feather-masked images placed by
 *  the SAME panelLayout math (projected once to a CSS rect at the REST
 *  camera — no parallax without WebGL, but the composition, depth ordering,
 *  and fades are all intact). BuilderCaptions (mounted separately in
 *  App.tsx, unconditionally) still renders the museum labels here — App.tsx
 *  passes it `reducedMotion={reducedMotion || !webgl}` so its own
 *  projection ALSO pins to the REST camera in this branch, matching these
 *  static panels frame for frame instead of tracking a dolly that isn't
 *  actually happening. */
export function BuilderFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const kaelbotRef = useRef<HTMLDivElement>(null);
  const milieuosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth;
      const h = filmHeight();
      const refs: Record<PanelId, React.RefObject<HTMLDivElement | null>> = {
        kaelbot: kaelbotRef,
        milieuos: milieuosRef,
      };
      (Object.keys(refs) as PanelId[]).forEach((id) => {
        const el = refs[id].current;
        if (!el) return;
        const lay = panelLayout(id, w, h);
        // REST camera (0, 0, REST_Z) projection of the panel's own rect —
        // the no-parallax, static composition (see file header).
        const wpp =
          (2 * (REST_Z - PANEL_SPECS[id].z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
        const left = w / 2 + (lay.x - lay.width / 2) / wpp;
        const top = h / 2 - (lay.y + lay.height / 2) / wpp;
        el.style.left = `${left.toFixed(1)}px`;
        el.style.top = `${top.toFixed(1)}px`;
        el.style.width = `${(lay.width / wpp).toFixed(1)}px`;
        el.style.height = `${(lay.height / wpp).toFixed(1)}px`;
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const refs: Record<PanelId, React.RefObject<HTMLDivElement | null>> = {
      kaelbot: kaelbotRef,
      milieuos: milieuosRef,
    };
    const apply = (value: number) => {
      (Object.keys(refs) as PanelId[]).forEach((id) => {
        const el = refs[id].current;
        if (el) el.style.opacity = panelOpacity(id, value).toFixed(4);
      });
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="builder-fallback" aria-hidden="true">
      <div ref={kaelbotRef} className="builder-fallback-panel">
        <img src={PANEL_URLS.kaelbot} alt="" draggable={false} />
      </div>
      <div ref={milieuosRef} className="builder-fallback-panel">
        <img src={PANEL_URLS.milieuos} alt="" draggable={false} />
      </div>
    </div>
  );
}
