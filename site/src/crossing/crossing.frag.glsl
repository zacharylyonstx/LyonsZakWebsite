// ---------------------------------------------------------------------------
// THE CROSSING — CrossingMaterial fragment core (Experiment A2, LyonsZak.com).
//
// This is not a standalone fragment shader: it is the GLSL core that gets
// injected into EVERY world material (via onBeforeCompile on the game's own
// MeshStandardMaterials, and verbatim into the net-receiver ShaderMaterial).
// It projects the real backyard photograph from the LOCKED matched camera
// (site/experiments/match/camera.json) onto the game's true geometry and
// blends each fragment between the photo and the game's own shaded color.
//
// The mathematical anchor of the whole crossing: when the visitor camera's
// POSITION equals the projector's position, projective texturing is an
// identity mapping — every screen pixel samples the photo at its own screen
// coordinate, regardless of geometry, rotation, or FOV. So at the matched
// pose the screen IS the photograph, exactly; the peel only begins when the
// camera's position departs, and every disagreement that appears is real
// parallax against real geometry — not a crossfade.
//
// Split into marker-delimited chunks parsed by src/crossingMaterial.ts
// (marker names spelled with [] here so the parser never matches this doc):
//   [CROSSING_PARS]     uniforms / varyings / helpers (frag, before main)
//   [CROSSING_FRAG]     the blend, injected at the very end of main()
//                       (after three's <dithering_fragment>, so the photo
//                       bytes land on screen untouched by tone mapping —
//                       byte-exact against the depth-mesh layer at swap)
//   [CROSSING_VERT_*]   world-position/normal varyings (vertex)
// ---------------------------------------------------------------------------

//__CROSSING_PARS__
uniform sampler2D uPhoto;         // hero photo (raw bytes; colorSpace = NoColorSpace)
uniform sampler2D uProjDepth;     // RGBA-packed LINEAR view depth from the projector pose
uniform mat4 uPhotoProjMatrix;    // world -> projector clip (proj * view)
uniform mat4 uPhotoViewMatrix;    // world -> projector view (for linear-depth compare)
uniform vec3 uPhotoCamPos;        // projector position (the matched pose)
uniform vec3 uPhotoCamDir;        // projector forward, normalized
uniform float uProjFar;           // projector far plane (depth normalization)
uniform vec2 uProjTexel;          // 1.0 / projector depth-map resolution
uniform float uPhotoStrength;     // global photo weight: 1 at the swap -> 0 fully game
uniform float uDepartFacing;      // 0 at matched pose -> 1 once departed; gates the
                                  // visibility + facing terms (identity needs neither)
uniform float uGradeStrength;     // photo-matched grade on the game color (1 -> 0)
uniform float uGradeExposure;     // grade: exposure multiplier toward the photo's light
uniform float uGradeSat;          // grade: saturation retention (photo is muted)
uniform float uGrain;             // photo-grain retention on projected areas
uniform float uDistFadeNear;      // projector-space distance where the photo starts fading
uniform float uDistFadeFar;       // ... and where it is fully game (see distBound)
uniform float uDebugMode;         // 0 off; 1 weight; 2 vis; 3 facing; 4 smear; 5 distBound; 6 regionKeep

// ---- semantic-region art direction (G1.1 Task 4) --------------------------
// Six hand-built masks of the LOCKED photo (tools/masks/make-masks.py) let the
// peel be AUTHORED per region instead of emerging from the guard stack: each
// region crosses photo->game inside its own release window (timeline.ts
// REGION_RELEASE), as an organized luminance-ordered wipe. This is deliberate
// special-casing for this one photograph — the spec sanctions it ("that's not
// cheating, that's art direction").
uniform sampler2D uMaskA;         // photo-space masks: r kids, g trampoline+net, b playhouse
uniform sampler2D uMaskB;         // r canopy, g sky, b ground
uniform float uMasksOn;           // 1 once both mask textures are resident (0 = all "rest")
uniform vec3 uRelA;               // authored release 0..1 (photo -> game): kids, trampoline, playhouse
uniform vec3 uRelB;               // canopy, sky, ground
uniform float uRelRest;           // fence / patio overhang / everything unmasked

// Guard-term taps for the debug view (written by crossingWeight each fragment).
float dbgVis, dbgFacing, dbgSmear, dbgDist, dbgW, dbgKeep;

varying vec3 vCrossWorldPos;
varying vec3 vCrossNormal;        // world-space; vec3(0) when the material has no normals

// Unpack for three r184's packDepthToRGBA (packing.glsl): R holds the MOST
// significant byte (scaled by Inv255), A the least — the REVERSE of three's
// legacy packing. Mirrors UnpackFactors4 = ( 255/256 / (1, 256, 256^2), 1/256^3 ).
// (Getting this order wrong was the root cause of the "mystery slab": the
// visibility compare unpacked noise, read "far" almost everywhere, and let the
// photo paint straight through occluders onto distant geometry.)
float crossingUnpackDepth( const in vec4 rgba ) {
  const float UD = 255.0 / 256.0;
  const vec4 factors = vec4( UD, UD / 256.0, UD / ( 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 * 256.0 ) );
  return dot( rgba, factors );
}

// Static, photo-locked grain (the photo's own sensor texture, not TV noise):
// hashed on the photo-texel grid so it never crawls as the camera moves.
float crossingGrain( vec2 pUv ) {
  vec2 cell = floor( pUv * 2048.0 );
  float h = fract( sin( dot( cell, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  return h - 0.5;
}

// Grade the game's sunny saturated palette toward the photo's bright, diffuse,
// overcast-leaning late-afternoon light (NOT golden hour — the hero photo's
// light was re-characterized after review). The world "becomes itself" as
// uGradeStrength falls off during the departure.
vec3 crossingGrade( vec3 c ) {
  vec3 g = c * uGradeExposure;
  float l = dot( g, vec3( 0.299, 0.587, 0.114 ) );
  g = mix( vec3( l ), g, uGradeSat );
  // olive-ward: pull green toward the photo's muted foliage, sink blue a touch
  g *= vec3( 1.0, 0.98, 0.94 );
  // gentle haze lift in the shadows (overcast light has no crushed blacks)
  g = g * 0.97 + vec3( 0.02, 0.021, 0.02 );
  return mix( c, g, uGradeStrength );
}

// Soft projector-visibility: was this world point seen by the photo camera,
// or is it hidden behind something the photo DID see? 3x3 PCF over the
// projector's linear depth map, slope-aware bias in meters.
float crossingVisibility( vec3 worldPos, vec2 pUv ) {
  float fragDist = -( uPhotoViewMatrix * vec4( worldPos, 1.0 ) ).z;
  float bias = 0.06 + clamp( 2.0 * fwidth( fragDist ), 0.0, 0.35 );
  float vis = 0.0;
  for ( int y = -1; y <= 1; y++ ) {
    for ( int x = -1; x <= 1; x++ ) {
      vec2 off = vec2( float( x ), float( y ) ) * uProjTexel;
      float stored = crossingUnpackDepth( texture2D( uProjDepth, pUv + off ) ) * uProjFar;
      float diff = fragDist - stored - bias;
      vis += 1.0 - smoothstep( 0.0, 0.30, diff );
    }
  }
  return vis / 9.0;
}

// Per-region luminance-keyed dissolve. As `rel` sweeps 0 -> 1, fragments
// release in luminance order (darkest photo texels first) inside a feathered
// band — a region leaves as one organized wipe, never as a translucent slab.
// keep(rel=0) == 1 exactly for every key (the swap identity is untouched).
float crossingDissolveKeep( float rel, float key, float feather ) {
  float sweep = rel * ( 1.0 + 4.0 * feather ) - 2.0 * feather;
  return 1.0 - smoothstep( key - feather, key + feather, sweep );
}

// Region terms at a projector UV:
//   keep     — the art-directed photo retention (product term on the weight),
//              clamped to [0,1] before it returns (see the `min` at its end)
//              so w<=1 in crossingWeight is structural, not merely a property
//              of the mask textures the Python pipeline happens to produce
//   relLocal — the region's own release progress; facing/smear guards engage
//              with it (a HELD region shows the photograph as-is — partially
//              engaged guards were exactly the ghost-slab artifact)
//   gateVis  — visibility-guard gate; the playhouse suppresses visibility
//              during its hold so it crosses as ONE unit (photo covers its own
//              silhouette fully, no game roof condensing over the photo face)
void crossingRegions( in vec2 pUv, in float worldY, in float projDist, out float keep, out float relLocal, out float gateVis ) {
  vec3 mA = texture2D( uMaskA, pUv ).rgb * uMasksOn;
  vec3 mB = texture2D( uMaskB, pUv ).rgb * uMasksOn;
  float rest = clamp( 1.0 - mA.r - mA.g - mA.b - mB.r - mB.g - mB.b, 0.0, 1.0 );
  float key = dot( texture2D( uPhoto, pUv ).rgb, vec3( 0.299, 0.587, 0.114 ) );
  // Ground releases as a rolling near-to-far wipe (photo bottom first), with
  // a luminance-dappled edge — a plain dark-first dissolve read as horizontal
  // banding because the yard's shadows are horizontal stripes.
  float groundKey = 0.7 * clamp( pUv.y / 0.45, 0.0, 1.0 ) + 0.3 * key;
  // The held canopy may only dress geometry that could BE canopy: either at
  // canopy height (the oaks' clumps live above ~4m) or far beyond the yard
  // (the neighbor's trees past the fence, 14m+). Near-and-low geometry — the
  // playhouse roof at 7m, the fences, the receiver slab's fringe — must not
  // wear the held canopy as a stretched curtain during the rise (the game
  // playhouse is TALLER than the photo's; its roof pokes into canopy UVs
  // from the first frame). Departure-gated so the swap identity is untouched.
  float canopyBand = mix(
    1.0,
    max( smoothstep( 2.8, 4.5, worldY ), smoothstep( 14.0, 18.0, projDist ) ),
    uDepartFacing );
  keep = mA.r * crossingDissolveKeep( uRelA.x, key, 0.10 )   // kids — the last photo pixels to leave
       + mA.g * crossingDissolveKeep( uRelA.y, key, 0.10 )   // trampoline+net — one deliberate unit
       + mA.b * crossingDissolveKeep( uRelA.z, key, 0.07 )   // playhouse — short clean reveal
       + mB.r * crossingDissolveKeep( uRelB.x, key, 0.15 ) * canopyBand // canopy — soft coherent veil
       + mB.g * ( 1.0 - uRelB.y )                            // sky — featureless, plain fade
       + mB.b * crossingDissolveKeep( uRelB.z, groundKey, 0.10 ) // ground — the floor rolls into game
       + rest * crossingDissolveKeep( uRelRest, key, 0.10 ); // fence / patio / unmasked
  // `keep` is a SUM of per-region contributions, each <= 1 individually but
  // only <= 1 in total when the six mask channels partition the photo (sum
  // <= 1 at every texel). The Python renormalizes for that at native
  // resolution and downsamples the packed textures with an area-average
  // filter for the same reason (G1.1 Task 4 fix round 1) — but a texture
  // fetch is still one more filtering step (bilinear/mip) on top of that, so
  // treat the upstream sum<=1 property as a strong *expectation*, not a
  // proof, and clamp here: keep<=1 (and therefore w<=1 in crossingWeight,
  // and mix() never extrapolates past the photo/game pair) is GUARANTEED by
  // this line, independent of whatever the mask textures contain.
  keep = min( keep, 1.0 );
  relLocal = dot( mA, uRelA ) + dot( mB, uRelB ) + rest * uRelRest;
  // Visibility-guard gate: playhouse, ground and fence/rest suppress the
  // disocclusion test during their hold so each holds as ONE coherent piece
  // (without this, the net-receiver's depth stamp cuts a game-colored shadow
  // band through the held floor and fence). Trampoline/kids/canopy/sky keep
  // it armed — behind-the-slab geometry must NOT double-receive the kids.
  gateVis = 1.0 - clamp(
    mA.b * ( 1.0 - uRelA.z ) + mB.b * ( 1.0 - uRelB.z ) + rest * ( 1.0 - uRelRest ),
    0.0, 1.0 );
}

// The photo weight for a world point (0 = pure game, 1 = pure photo).
// Shared by the injected world materials and the net-receiver material.
float crossingWeight( in vec3 worldPos, in vec3 worldNormal, out vec2 pUvOut ) {
  pUvOut = vec2( 0.0 );

  vec4 photoP = uPhotoProjMatrix * vec4( worldPos, 1.0 );
  if ( photoP.w <= 0.0 ) return 0.0;  // behind the projector

  vec2 pUv = ( photoP.xy / photoP.w ) * 0.5 + 0.5;
  pUvOut = pUv;

  // feathered frustum containment (no hard rectangle at the photo's edge)
  const float F = 0.006;
  float inPhoto = smoothstep( 0.0, F, pUv.x ) * ( 1.0 - smoothstep( 1.0 - F, 1.0, pUv.x ) )
                * smoothstep( 0.0, F, pUv.y ) * ( 1.0 - smoothstep( 1.0 - F, 1.0, pUv.y ) );
  if ( inPhoto <= 0.0 ) return 0.0;

  // Art-directed region terms (G1.1 Task 4): where a region still HOLDS the
  // photo, the cosmetic guards stay out of the frame (a partially-engaged
  // guard was the ghost-slab artifact); they engage as the region releases.
  float projDistEarly = -( uPhotoViewMatrix * vec4( worldPos, 1.0 ) ).z;
  float keep, relLocal, gateVis;
  crossingRegions( pUv, worldPos.y, projDistEarly, keep, relLocal, gateVis );
  float departVis = uDepartFacing * gateVis;
  float departFS = uDepartFacing * relLocal;

  // visibility + facing + smear are parallax-error guards; at the matched
  // pose the identity mapping makes them unnecessary AND their acne harmful,
  // so they ramp in with departure (uDepartFacing) instead of being always-on.
  float vis = mix( 1.0, crossingVisibility( worldPos, pUv ), departVis );

  float facing = 1.0;
  if ( dot( worldNormal, worldNormal ) > 0.25 ) {
    // Tightened after the debug-heat pass: the flat lawn scores ~0.08 and the
    // playhouse roof ~0.25 on -dot(N, dir); both must reject (their photo
    // texels smear), while true photo-facing surfaces (walls, fence) sit
    // above 0.9 and keep full weight.
    float f = smoothstep( 0.10, 0.40, -dot( normalize( worldNormal ), uPhotoCamDir ) );
    facing = mix( 1.0, f, departFS );
  }

  // Near-ghost guard (G1.1 Task 4): a fragment clearly NEARER the projector
  // than what the photograph saw at that UV is geometry the photo looked
  // PAST (the game playhouse roof in front of photo canopy, a pole in front
  // of sky) — during a region HOLD it must not wear those texels as a
  // stretched curtain. Mirror image of the visibility guard (which rejects
  // fragments BEHIND the stored depth); shares its gate, so the playhouse
  // exemption and the matched-pose identity both carry over.
  float storedC = crossingUnpackDepth( texture2D( uProjDepth, pUv ) ) * uProjFar;
  float fragProjDist = -( uPhotoViewMatrix * vec4( worldPos, 1.0 ) ).z;
  float nearGhost = mix( 1.0, 1.0 - smoothstep( 0.8, 2.5, storedC - fragProjDist ), departVis );
  vis *= nearGhost;

  // Magnification guard: on surfaces the projector only grazes (a roof slab,
  // leaf clumps edge-on to the photo), one photo texel stretches across many
  // screen pixels and the photo smears into streaks. Detect it directly —
  // photo texels per screen pixel — and fade those regions to game material.
  // Direction-aware: take the MOST magnified screen axis (min derivative), so
  // a roof stretched down-slope but fine across-slope still reads as smeared
  // (length(fwidth()) let those through as vertical rain-streaks).
  // At the matched pose magnification is ~uniform (~1 texel/px), untouched.
  // Thresholds set against the matched pose's ~1.3 texels/px baseline: the
  // playhouse roof measured ~0.35 (drippy streaks) and must die, while the
  // full-frame identity at ~1.3 stays safely above the ramp.
  float texelsPerPx = min( length( dFdx( pUv ) ), length( dFdy( pUv ) ) ) * 2048.0;
  float smear = mix( 1.0, smoothstep( 0.30, 0.75, texelsPerPx ), departFS );

  // Distance bound: the photograph's content lives in the backyard (fence,
  // oaks, playhouse — all within ~45m of the camera that took it). A world
  // point much farther from the projector cannot be "in" the photo; without
  // this, canopy pixels stream between the game's (differently shaped) oak
  // clumps and re-image the photograph on the greenbelt 100m+ away — the
  // giant translucent wash. Gated by uDepartFacing so the matched-pose
  // identity stays byte-exact; as departure begins, the far world resolves to
  // game FIRST and the yard holds the photograph longest (depth-ordered peel).
  float projDist = -( uPhotoViewMatrix * vec4( worldPos, 1.0 ) ).z;
  float distBound = mix( 1.0, 1.0 - smoothstep( uDistFadeNear, uDistFadeFar, projDist ), uDepartFacing );

  dbgVis = vis; dbgFacing = facing; dbgSmear = smear; dbgDist = distBound; dbgKeep = keep;
  dbgW = inPhoto * vis * facing * smear * distBound * keep * uPhotoStrength;
  return dbgW;
}

// The photo color at a projector UV (grain retained on projected areas).
vec3 crossingPhotoColor( in vec2 pUv ) {
  return texture2D( uPhoto, pUv ).rgb + crossingGrain( pUv ) * uGrain;
}

// `gameColor` goes in already final (post tone-map); comes back graded + blended.
vec3 crossingApply( vec3 gameColor ) {
  // Fast path (G1.1 Task 3, street-reveal perf): once the photograph has
  // fully released (uPhotoStrength == 0), every projection term — including
  // the 9-tap PCF visibility sample — is multiplied to zero and the blend
  // returns the graded game color unchanged. Skip the dead math. Bit-exact:
  // w = ... * uPhotoStrength == 0.0 -> the full path returns `graded` too.
  if ( uPhotoStrength <= 0.0 && uDebugMode < 0.5 ) {
    return crossingGrade( gameColor );
  }
  vec3 graded = crossingGrade( gameColor );
  vec2 pUv;
  float w = crossingWeight( vCrossWorldPos, vCrossNormal, pUv );
  if ( uDebugMode > 0.5 ) {
    float d = uDebugMode < 1.5 ? dbgW
            : uDebugMode < 2.5 ? dbgVis
            : uDebugMode < 3.5 ? dbgFacing
            : uDebugMode < 4.5 ? dbgSmear
            : uDebugMode < 5.5 ? dbgDist
            : dbgKeep;
    // heat: black (0) -> red -> yellow (1); geometry shading hinted at 10%
    return mix( gameColor * 0.1, vec3( d, d * d, 0.0 ), 0.92 );
  }
  if ( w <= 0.0 ) return graded;
  return mix( graded, crossingPhotoColor( pUv ), w );
}
//__END__

//__CROSSING_FRAG__
gl_FragColor.rgb = crossingApply( gl_FragColor.rgb );
//__END__

//__CROSSING_VERT_PARS__
varying vec3 vCrossWorldPos;
varying vec3 vCrossNormal;
//__END__

// Injected after three's <project_vertex> (instancing-aware, mirrors its
// transform order). vCrossNormal is filled by a separate injection after
// <defaultnormal_vertex> when the material has normals.
//__CROSSING_VERT_POS__
{
  vec4 _cwp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    _cwp = instanceMatrix * _cwp;
  #endif
  #ifdef USE_BATCHING
    _cwp = batchingMatrix * _cwp;
  #endif
  vCrossWorldPos = ( modelMatrix * _cwp ).xyz;
}
//__END__

//__CROSSING_VERT_NORMAL__
vCrossNormal = inverseTransformDirection( transformedNormal, viewMatrix );
//__END__

//__CROSSING_VERT_NONORMAL__
vCrossNormal = vec3( 0.0 );
//__END__
