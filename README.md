# Agentic AI Video Editor

> **An autonomous agentic video editor.** Send a sentence. Get a finished video. No timelines, no keyframes, no plugin chains. Get hundreds of reels and edits rendered within seconds using massive parallel GPU rendering infrastructure.

[![ClawHub](https://img.shields.io/badge/ClawHub-plugin-blue)](https://clawhub.ai/plugins/openclaw-ai-video-editor)
[![npm](https://img.shields.io/npm/v/levea-mcp-server?label=npm%20levea-mcp-server)](https://www.npmjs.com/package/levea-mcp-server)

> **Beta.** The agent can make mistakes. Preview every output before publishing or sharing. For high-stakes or irreversible edits, pass `requirePlanApproval: true` so the agent stops after planning and waits for your approval before anything runs.

---

## Contents

1. [Quickstart](#quickstart) — running in 60 seconds
2. [What it does](#what-it-does) — say it, get it
3. [Capability surface](#capability-surface) — the full toolset
4. [Renderer & technical architecture](#renderer--technical-architecture) — Vulkan GPU compositor, shader pipeline, MG library
5. [Goals & briefs](#goals--briefs) — from one line to a full creative brief
6. [API reference](#api-reference) — endpoints, request/response, streaming, async
7. [Who it's for](#who-its-for) · [vs. legacy editors](#vs-legacy-editors) · [Safety](#safety--limits) · [Media](#supported-media)
8. [Links & channels](#links--channels)

---

## Quickstart

The portable interface is the **[`levea-mcp-server`](https://www.npmjs.com/package/levea-mcp-server)** MCP server — one server, every MCP client (Claude Desktop, Claude Code, Cursor, Cline, OpenClaw, Hermes), one tool surface, one backend contract, so nothing drifts per platform.

**1. Get an API key** — sign up at **[studio.livecore.ai](https://studio.livecore.ai)** and generate an OpenClaw API key.

**2. Add the MCP server** — the same `npx` line works for every MCP client:

```jsonc
{
  "mcpServers": {
    "levea": {
      "command": "npx",
      "args": ["-y", "levea-mcp-server"],
      "env": {
        "LEVEA_API_URL": "https://api.livecore.ai",
        "LEVEA_API_KEY": "your-key-from-studio.livecore.ai"
      }
    }
  }
}
```

**3. Use it** — say to your AI: *"Use the levea tool to generate 5 viral clips from this video, add captions, reframe vertical."* The agent picks the tool, fills the prompt; the editor plans → executes → exports.

### Per-client setup

| Client | How |
|---|---|
| Claude Desktop / Cursor / Cline | Add the `levea` block above to `mcpServers` — see the [`levea-mcp-server`](https://www.npmjs.com/package/levea-mcp-server) docs |
| Claude Code | `claude mcp add levea -e LEVEA_API_URL=https://api.livecore.ai -e LEVEA_API_KEY=... -- npx -y levea-mcp-server` |
| OpenClaw | This ClawHub listing (chat-native) **or** `openclaw mcp add levea --command "npx -y levea-mcp-server" --env LEVEA_API_URL=https://api.livecore.ai --env LEVEA_API_KEY=...` |
| Hermes | Register `levea-mcp-server` as an MCP server in your Hermes config |

> **This listing on ClawHub:** `openclaw plugins install clawhub:openclaw-ai-video-editor`

Every client calls the **same backend** — the MCP server, this ClawHub listing, and every other surface share one tool contract.

### Two hosts — don't confuse them

| Host | Use |
|---|---|
| **https://api.livecore.ai** | Functional API. Set as `LEVEA_API_URL`. The client appends `/api/v1/misc/openclaw/v1/execute` automatically — never put a full path here. |
| **https://studio.livecore.ai** | API-key portal (UI). Get your key here. Do **not** use as `LEVEA_API_URL`. |

> Env vars are `LEVEA_API_URL` / `LEVEA_API_KEY`.

### Tools the AI sees

**One editing entry point. Everything else is typed state-management and polling** — so integrators can build full editing experiences through one API key instead of mixing JWT and MCP.

| Group | Tools |
|---|---|
| **Edit** (one entry point, 3 variants) | `autonomous_edit` (primary, JSON) · `autonomous_edit_streaming` (SSE — per-step progress) · `queue_edit` (async fire-and-forget) |
| Job / task polling | `check_job_status` · `check_task_status` · `get_active_task` |
| Caption templates | `list_caption_templates` · `apply_caption_template` · `save_caption_template` · `save_current_caption_template` · `delete_caption_template` (25+ builtin + your saved) |
| Brand kits | `list_brand_kits` · `get_brand_kit` · `create_brand_kit` · `update_brand_kit` · `delete_brand_kit` (palette · fonts · logo · voice · gradeBias · enforcement) |
| Projects | `list_projects` · `get_project` · `create_project` · `delete_project` |
| Assets | `asset_upload_url` (signed PUT) · `list_assets` · `delete_asset` · `transcribe_asset` |
| Diagnostics | `editor_health` |

**No edit shims** (`add_captions`, `generate_viral_clips`, …) and no `editor_execute` escape hatch. The backend's planner is the specialist — fragmenting the editing surface encourages calling LLMs to second-guess the planner and lose multi-step intent. State-management tools (brand / project / asset / caption-template CRUD) aren't editing, so they don't fragment intent — they just give integrators typed access.

→ For agent-integration details (schemas, async semantics, error handling, plan approval), see **[AGENTS.md](https://github.com/brajendrak00068/agentic-ai-video-editor/blob/main/AGENTS.md)**.

---

## What it does

Say it in plain language; the agent plans and finishes the edit.

| You ask | It does |
|---|---|
| "Generate 5 viral clips" | Finds the best moments, reframes vertical, adds elite captions, exports MP4s |
| "Add motion graphics to my podcast" | Plans 128+ MG types, materializes animated overlays, verifies output |
| "Change the voiceover to Hindi" | Clones voice, synthesises Hindi TTS, auto-ducks music, resyncs captions |
| "Find every clip where Alex appears" | Face embedding search across all assets, returns timestamped matches |
| "Remove the background" | Neural matting, per-frame alpha, no green screen |
| "Color grade this cinematic" | LUT + 3-way color wheels, prompt-driven preset |
| "Make this TikTok-ready" | Vertical reframe, bold captions, silence removal, beat sync, export |

---

## Capability surface

### Timeline & Editing Core
- Multi-track timeline with layer groups, locking, visibility toggles, snap guides, zoom, scrubbing
- Trim, split, crop, speed ramps, freeze frame, reverse clip
- Keyframe animation — position, scale, rotation, opacity, blur, volume — with easing curves
- 17 Photoshop-accurate blend modes · masking (luma, alpha, chroma, depth, LUT)
- Canvas configuration — dimensions, aspect, FPS
- Batch updates · undo/redo · scene save/load/duplicate · final reconcile

### Captions & Text
- Generate captions from transcript; restyle or translate existing ones
- 25+ built-in caption templates (Hormozi, MrBeast, neon-pop, word-pill, karaoke, explainer-burst, and more)
- Import SRT / VTT · caption repair · filler-word removal · safe-zone repair
- Title cards, lower-thirds, end cards / CTAs · chapter markers · text on a path
- MSDF/SDF rendering — sharp at any size, 10 visual modes (plain, outline, shadow, glow, neon, striped, and more)
- Per-character animation: typewriter, slide, fade, scale, bounce, flip, rotate, karaoke word-highlight

### Audio & Voice
- AI voiceover (Google Cloud TTS) — 40 languages · multi-language dubbing/translation
- Voice cloning — custom voices from reference + consent recordings
- AI music generation (Lyria, prompt-driven) · sound effects generation
- Audio mastering to platform targets (YouTube / Spotify / TikTok / Podcast / Cinema, EBU R128 LUFS)
- Parametric EQ (8 bands) · mixing & dynamics · crossfades (J/L-cut) · auto-ducking (4 modes)
- Silence removal · beat-sync editing · stem separation · mute/solo

### Color, VFX & Visual Treatment
- LUT color grading + 3-way color wheels (lift/gamma/gain) + 12 cinematic preset looks
- 21 procedural VFX: smoke, fire, explosion, portal, lightning, lava, snow, bokeh, glitch, decay/corrosion, scanlines/CRT/VHS, film grain, glassmorphism, halftone, liquid/gooey, holographic, kaleidoscope, dithering, tunnel/wormhole, aurora/mesh gradient, light sweep
- AI neural background removal — no green screen required
- Chroma key / green screen · branding overlays · face/motion tracking with dynamic zoom
- Video stabilization · noise reduction · depth-map driven effects
- Waveform / vectorscope scopes

### AI Content Generation
- Text-to-image / text-to-video (Imagen, Veo) · image-to-video · extend-video
- B-roll generation — contextual, transcript-grounded
- Motion graphics — 128+ animated types (see [Motion Graphics Library](#motion-graphics-library))
- Thumbnail generation · generate-from-brief · slideshow (Ken Burns)
- Frame analysis — deep frame-by-frame visual analysis

### Charts & Data Visualization
- Bar grow, line reveal, pie segment, icon array waffle, dashboard (multi-panel), bar race, sankey flow, treemap
- Auto-detect chartable data in narration and build the chart
- Brand-aware styling · canvas-responsive

### Viral / Social & Multi-Platform
- Viral clip selection — find best moments; export combined reel or separate clips
- Vertical reframe to 9:16 with face-aware tracking
- Multi-platform export — TikTok, Reels, Shorts, YouTube, LinkedIn, Instagram in one pass
- Split-screen / PIP · multi-cam sync · cross-asset face/speaker search

### Privacy & Compliance
- Face blur · privacy redaction · profanity cleanup · object hide
- Content-safety gating — blocks deepfakes, fake testimonials, unauthorized likeness

### Export & Delivery
- H.264, H.265, WebM · 4K UHD, 1440p, 1080p, 720p, 480p
- TikTok Pro, TikTok/Reels, Square, IG-portrait presets
- SRT / VTT subtitle export · pre-export delivery check
- Up to 3 hours per asset

---

## Renderer & Technical Architecture

> Everything below is implemented in production — not planned. The renderer is the moat: no competitor in this space runs a real GPU compositor server-side.

### Architecture

```
User prompt / API call
  → LLM emits typed IR (intent + params)
  → Deterministic DAG compiler (60+ task kinds, 118+ canonical actions)
  → Gated executor → PowerPacks
  → Verifier → bounded repair loop (max 2 attempts)
  → Vulkan GPU compositor → NVENC → GCS export
```

**Preview** runs on WebGPU in the browser. **Export** runs on Vulkan server-side. Both surfaces share the same shader source — compiled to SPIR-V for Vulkan and consumed natively by WebGPU — so preview and export output are **pixel-identical**.

Hardware pipeline: **NVDEC** video decode → **CUDA → Vulkan zero-copy texture pool** (ML inference results feed compositor directly) → **NVENC** H.264/H.265 encode.

### Post-Processing Shader Pipeline

18-pass compositor stack, each pass independent and keyframe-controllable:

| Pass | What it does |
|---|---|
| Screen-space global illumination (SSGI) | Bounce lighting from scene content — one-bounce indirect colour |
| Screen-space ambient occlusion (SSAO) | Contact shadows and depth cues |
| Volumetric god rays | Light shaft / crepuscular ray scattering |
| Surface reflections | Planar environment reflections |
| Lens flare | Anamorphic / optical lens flare streaks |
| Multi-pass bloom | Bright-pass → downsample → upsample → composite — cinema-grade bloom |
| Per-layer glow | Soft glow halo composited under crisp layer |
| Drop shadow | Real shadow composite pass |
| Depth of field / bokeh | Camera DOF with bokeh disk simulation |
| Chromatic aberration | Radial RGB channel split |
| Vignette | Corner-darkening lens vignette |
| Film grain | Luminance-weighted organic grain, animated per-frame |
| LUT color grading | 3D LUT color transform + 12 cinematic preset looks |
| Mesh gradient / aurora | Animated multi-stop blob gradient (Apple-style) |
| Adjustment layer | Non-destructive brightness / contrast / saturation / hue / temperature |
| Color scopes | RGB Parade broadcast monitoring |
| Motion blur | Shutter-angle + sample-count, keyframe-animated per layer |
| Order-independent transparency | Correct alpha compositing for overlapping transparent layers |

> **SSGI is not a standard video editor feature.** DaVinci Resolve ships it as a premium Fusion node; After Effects requires third-party plugins. It's a built-in shader pass here.

### VFX Effects (21)

All keyframe-animated with `intensity`, `speed`, `size`, `spread`, `seed` controls:

`smoke/dust/steam/mist/fog` · `fire` · `explosion/glimmer` · `portal` · `lightning` · `lava` · `snow` · `bokeh` · `glitch` · `decay/corrosion` · `scanlines/crt/vhs` · `film_grain` · `glassmorphism/frosted_glass` · `halftone` · `gooey/liquid` · `holographic/iridescent` · `kaleidoscope` · `dithering/bayer` · `tunnel/wormhole` · `aurora/mesh_gradient` · `light_sweep/shine`

### GPU Compute Particle Physics

Physics simulated on GPU via compute shaders — real particle dynamics, not sprite animations:

**Rain** · **Snow** · **Dust / Embers** · **Portal vortex** — each particle system runs velocity, drag, gravity, and lifetime simulation on the GPU per frame.

### Transitions (33)

All directional (8 directions). Optional neon edge-glow composited on the seam.

**Basic:** fade · slide · wipe · iris · zoom · blur fade · cross dissolve · whip pan · zoom blur

**Cinematic:** dip to black · dip to white · luma fade · glitch · spin blur · spin · RGB split · VHS static · film dissolve · glow dissolve · directional blur

**Geometric / Pattern:** radial wipe · barn door · checkerboard · gradient wipe · venetian blinds · star wipe · bowtie wipe · pixelate dissolve · ripple warp · lens distort · polka dots · perlin dissolve · kaleidoscope

### Blend Modes (17)

Normal · Multiply · Screen · Overlay · Darken · Lighten · Color Dodge · Color Burn · Hard Light · Soft Light · Difference · Exclusion · Hue · Saturation · Color · Luminosity · Additive

### 3D Transforms

Per-layer 3D transforms: perspective camera · rotate X/Y/Z · translate Z (depth) · parallax 2.5D camera push · 3D card flip · extruded 3D text

### Text Rendering (MSDF/SDF)

Pixel-perfect at any size. 10 SDF visual modes: plain · outline · shadow · outline+shadow · outer glow · inner glow · dual glow/neon · striped · landscape gradient · overload (multi-color)

Per-character animation: typewriter · slide up/down/left/right · fade in · scale in · rotate in · bounce in · flip in · karaoke word-highlight (transcript-synced)

### Animation Runtimes

**Skottie / Lottie** — rendered via Skia on the Vulkan GPU backend. Full spec: trim paths, repeaters, blend modes, expressions. GPU-accelerated, zero-copy path from decoder to compositor. 158 bundled accent-grade assets. LLM-generated concept Lotties via procedural builder. SVG → Lottie transpiler (nested groups, transforms, opacity).

**Rive** — state machine + timeline animations, GPU-accelerated on Vulkan.

### AI Perception (GPU)

All inference runs on GPU. Capabilities:

| Capability | What it does |
|---|---|
| Face recognition | Face embeddings → cross-asset speaker search |
| Object detection | Open-vocabulary — detect anything by text query |
| Background matting | Neural per-frame alpha, no green screen required |
| Depth estimation | Scene depth map for DOF and spatial effects |
| Text detection + OCR | On-screen text regions |
| Shot detection | Scene boundaries + beat analysis |
| Speaker diarization | Who is speaking when |
| Face landmarks | Lipsync, face tracking, dynamic zoom |

---

## Motion Graphics Library

**128+ motion graphic types** — all LLM-selectable, all animated, all rendered by the Vulkan compositor.

### Charts & Data Visualization (8)
`chart.bar_grow` · `chart.line_reveal` · `chart.pie_segment` · `chart.icon_array_waffle` · `chart.dashboard` · `chart.bar_race` · `chart.sankey_flow` · `chart.treemap`

### Diagrams & Process (5)
`diagram.explainer` · `diagram.schematic` · `diagram.equation` · `process.flowchart` · `process.decision_tree`

### Lists & Comparisons (5)
`list.numbered_steps` · `list.bullet_stagger` · `compare.vs_card` · `compare.split_screen` · `compare.checklist`

### Stats & Data Callouts (8)
`stat.counter` · `stat.big_number` · `stat.percentage_ring` · `stat.comparison_bar` · `stat.trend_arrow` · `stat.growth_chart` · `stat.leaderboard` · `stat.multi_metric`

### Captions & Kinetic Subtitles (4)
`caption.word_pop` · `caption.keyword_highlight` · `caption.supersize` · `caption.emoji_burst`

### Kinetic Typography & Titles (15)
`text.paragraph` · `text.word_swap` · `text.echo_stack` · `text.on_path` · `text.typewriter_prompt` · `text.glitch_reveal` · `text.stretch` · `text.mirror` · `text.cascade` · `text.neon_glow` · `text.word_reveal` · `title.section_card` · `title.mega_type` · `title.blend_overlay` · `title.extrude_3d`

### Product / SaaS / Pitch Deck (8)
`mockup.browser` · `mockup.phone` · `product.callout` · `product.hero_reveal` · `pricing.tiers` · `feature.grid` · `logo.cloud` · `social.testimonial`

### Geo & Maps (4)
`geo.country_highlight` · `geo.route_draw` · `geo.map_zoom_pin` · `geo.globe_spin`

### Media & Imagery (4)
`media.broll_card` · `media.video_card` · `media.annotated_photo` · `media.double_exposure`

### Quotes, Attribution & Lower Thirds (3)
`quote.callout` · `source.card` · `name.lower_third`

### CTA / Engagement / YouTube / HUD (8)
`cta.subscribe_button` · `cta.engagement_bar` · `poll.choice_card` · `hud.scoreboard` · `progress.chapter_bar` · `timer.countdown` · `youtube.info_card_teaser` · `youtube.end_screen_layout`

### FX / Ambient / Backgrounds (10)
`fx.radial_pulse` · `fx.confetti_burst` · `fx.gradient_sweep` · `fx.color_blocks` · `fx.filter` · `fx.particles` · `fx.lens_flare` · `fx.audio_waveform` · `bg.gradient_morph` · `bg.blob_gradient`

### Glass / UI / Motion Devices (8)
`layout.glass_card` · `layout.glass_menu` · `layout.social_notification` · `layout.ticker_tape` · `layout.composition` · `button.liquid_glass` · `button.glass_toggle` · `card.flip`

### Cinematic & Depth (2)
`scene.parallax_3d` · `focus.pointer_highlight`

### Utility (5)
`concept.icon_lottie` · `logo.reveal_stroke` · `privacy.blur_region` · `time.timeline_marker` · `none`

---

## Goals & briefs

The agent classifies every prompt into a production goal and selects the appropriate workflow:

**Goals:** viral social · marketing promo · sales demo · educational · raw-to-polished · event highlight · talking head · platform export · scene edits · conversational inquiry

**Export styles:** viral clips · single · multi-platform · none (scene-edit only)

For complex briefs, pass a structured `prompt` with multiple objectives. The DAG compiler expands them into ordered, gated tasks — so "reframe vertical, add captions, remove silences, and export for TikTok" runs as four verified steps, not four separate calls.

---

## API reference

All paths are under `/api/v1/misc/openclaw`.

| Endpoint | Purpose |
|---|---|
| `POST /v1/execute` | Run `autonomous_edit` (the main entry point) |
| `POST /v1/queue-edit` | Fire-and-forget async edit |
| `GET  /v1/jobs/{jobId}` · `GET /v1/task-status/{taskId}` | Poll async render / generation jobs |
| `GET  /v1/projects/{id}/active-task` | The project's in-flight task, if any |
| `GET  /v1/tools` · `GET /v1/health` | List tool names · health check |
| `/v1/brands` · `/v1/projects` · `/v1/assets/*` | Brand-kit / project / asset CRUD — list · get · create · update · delete |
| `/v1/caption-templates` (+ `/apply`, `/save-current`) | Caption-template CRUD + apply |

Each management group above is also exposed as a typed MCP tool (see [Tools the AI sees](#tools-the-ai-sees)).

> `LEVEA_API_URL` is the bare host `https://api.livecore.ai` — not a full path, not `studio.livecore.ai`, and not the in-product `/api/v1/misc/editor/` route.

### Request

Every edit goes through one tool — `autonomous_edit`. Pass a natural-language description; the agent plans, executes, verifies, and exports. No tool list to memorize, no structured params to learn.

```bash
curl -sS -X POST "$LEVEA_API_URL/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $LEVEA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {
      "prompt": "Make this a TikTok-ready viral clip: vertical reframe, bold captions, remove silences, motion-track the speaker, and export."
    },
    "project_id": "my-project"
  }'
```

`prompt` is the only required field. Everything else is optional:

| Param | Purpose |
|---|---|
| `prompt` | The natural-language edit instruction (**required**) |
| `project_id` | Reuse an existing project's scene + history |
| `scene` | Inline scene state, as an alternative to `project_id` (round-trip the `scene` from a previous response) |
| `video_url` | Start from a single video URL with no prior scene |
| `assets` | Multiple input assets (the first video seeds the scene) |
| `attachedImages` | Reference / style screenshot image URLs |
| `flaggedIssues` | Specific problems from a prior output to fix on this pass |
| `captionTemplatePreset` / `captionTemplateMode` | Force a named caption style + how it's applied |
| `brandId` / `projectBrandId` | Apply a brand kit (palette · fonts · logo · voice) |
| `requirePlanApproval` | Stop after planning and wait for approval — see [Plan approval](#plan-approval) |
| `workingMemory` / `editedPlan` | Resume state + revised plan for the approval loop |

### Response

```json
{
  "type": "success | partial_success",
  "tool": "autonomous_edit",
  "success": true,
  "partial": false,
  "status": "completed | failed | awaiting_approval",
  "scene": { },
  "reply": "Human-readable summary of what changed",
  "message": "Short status message",
  "videoUrl": "https://.../output.mp4",
  "jobId": "12345",
  "viral_clips": [ ],
  "zip_url": "https://.../clips.zip",
  "activeTasks": [ ],
  "pendingAsyncJobs": [ ],
  "verificationPassed": true,
  "verificationIssues": [],
  "quality": {
    "score": 0.94,
    "stepsTotal": 7,
    "stepsFailed": 0,
    "hasExportedMedia": true,
    "mediaReachable": true
  },
  "processingTime": 12.3,
  "workingMemory": { }
}
```

`jobId` is the numeric `task_id` (a string of digits), not a `task_`-prefixed value. `quality` is a calibrated post-run score block; `partial` is the top-level partial-success flag (mirrors `type: "partial_success"`).

### SSE streaming

Set `Accept: text/event-stream` or `?stream=true`. Notable event types:

| Event | Meaning |
|---|---|
| `heartbeat` | 15s keepalive |
| `status` · `phase` | Phase / status transitions |
| `thought` · `reasoning_chunk` | Per-step reasoning visibility |
| `tool_call` · `tool_result` | Action started / finished |
| `background_job_completed` | Async job done |
| `success` / `partial_success` | Terminal payload |
| `error` | Terminal failure |

### Async job lifecycle

Generation actions return immediately with a `jobId`. Poll until terminal:

```bash
JOB_ID=$(jq -r '.jobId // .activeTasks[0].intent.job_id' /tmp/result.json)
while true; do
  STATUS=$(curl -sS "$LEVEA_API_URL/api/v1/misc/openclaw/v1/jobs/$JOB_ID" \
    -H "Authorization: Bearer $LEVEA_API_KEY" | jq -r '.status')
  echo "Status: $STATUS"
  case "$STATUS" in completed|succeeded|failed|error|cancelled) break;; esac
  sleep 5
done

curl -sS "$LEVEA_API_URL/api/v1/misc/openclaw/v1/jobs/$JOB_ID" \
  -H "Authorization: Bearer $LEVEA_API_KEY" | jq '.result'
```

### Auto-export

After any **mutating** tool call that changed the scene (including partial successes), if no export is already queued the route auto-fires one **synchronously** — so the response carries a real `videoUrl`. Read-only and conversational `autonomous_edit` calls do **not** trigger auto-export.

### Plan approval

Pass `requirePlanApproval: true` to make the agent stop after planning. It returns `status: "awaiting_approval"` + populated `workingMemory`. Resume by sending the same `workingMemory` with an approval prompt (`yes`, `approve`, `go`, `do it`, `confirm`).

---

## Who it's for

| Audience | What they get |
|---|---|
| **Creators & influencers** | Long videos → TikToks / Reels / Shorts · auto-captions · viral-clip generation · AI thumbnails |
| **Podcasters** | Video-podcast highlights · audiograms · multi-cam editing · silence + filler-word removal |
| **Marketers & agencies** | Ad creation at scale · social-first repurposing · brand-overlay automation · multi-platform exports |
| **Educators & course creators** | Tutorial editing · auto-chapters · title / chapter cards · auto-captions · word-level emphasis |
| **YouTubers** | Long-form → Shorts pipeline · thumbnail generation · intro/outro automation · chapter markers |
| **Sales & SaaS** | Product demos · walkthrough highlights · cloned-voice narration |
| **Event teams** | Webinar / conference highlights · multi-cam stitching · speaker spotlight reels |
| **Faith & community** | Sermon clips for social · message highlights · multi-platform packaging |

---

## vs. legacy editors

| | Premiere / DaVinci / CapCut / Descript | OpenClaw AI Video Editor |
|---|---|---|
| **Interface** | Drag, drop, keyframe by hand | One sentence; the agent does the rest |
| **Renderer** | Client-side GPU (desktop app) or FFmpeg (web) | Server-side Vulkan GPU compositor — scales horizontally, no client compute required |
| **Motion graphics** | After Effects (separate app) or none | 128+ animated types, single agent call |
| **Post-processing** | Basic filters / manual | SSGI · SSAO · god rays · DOF · multi-pass bloom · chromatic aberration · motion blur |
| **Auto-analysis on upload** | Manual scene detection + subtitles | Faces, speakers, shots, on-screen text, neural mattes — detected automatically on GPU |
| **"Make this viral"** | You build the workflow | Single prompt — vertical + captions + silences + tracking |
| **Cross-asset search** | Filename search | "Find every clip where Alex appears" — face embedding search |
| **Background remove** | Key out, find background, composite | Neural matting — one call, no green screen |
| **Audio** | Manual loudness metering + EQ | Auto LUFS-normalized · EQ · ducking · voice cloning · 40-language TTS |
| **Editorial reasoning** | You decide the climax | Agent surfaces narrative peaks and reaction moments |
| **Verification** | You eyeball it | Typed verifier runs after execution; bounded auto-repair on failure |
| **Multi-platform export** | One render per ratio | TikTok + Reels + Shorts + YouTube + LinkedIn + Instagram in one pass |

---

## Safety & limits

- **Beta** — outputs can be wrong. Preview every result before sharing. For irreversible workflows, pass `requirePlanApproval: true` to inspect and approve the plan first.
- API-key authentication on every request.
- Destructive actions (mass deletes, clears) require explicit confirmation params.
- Output is verified after execution; auto-repairs on failure.
- Concurrent identical requests are deduplicated server-side.
- Rate-limited per API key. Read-only ~1–3s · structural edits ~3–10s · async generation 30s–5min per artifact · viral-clip / multi-platform exports several minutes.

---

## Supported media

| | Formats |
|---|---|
| **Video in** | MP4, MOV, WebM (HTTP/HTTPS URLs, YouTube URLs, gallery IDs) |
| **Image in** | JPG, PNG, WebP |
| **Audio in** | MP3, WAV, M4A, AAC (or extracted from video) |
| **Output** | MP4 H.264/H.265 · WebM · ZIP (viral clips / multi-platform bundles) |
| **Resolution** | 4K UHD · 1440p · 1080p · 720p · 480p · TikTok/Reels · Square · IG-portrait |
| **Max video length** | Up to **3 hours** per asset (plan-dependent) |

---

## Links & channels

| Channel | Identifier / link |
|---|---|
| npm (MCP server) | [`levea-mcp-server`](https://www.npmjs.com/package/levea-mcp-server) |
| MCP Registry | `io.github.brajendrak00068/levea-mcp-server` ([registry](https://registry.modelcontextprotocol.io/v0/servers?search=levea-mcp-server)) |
| ClawHub plugin | [`openclaw-ai-video-editor`](https://clawhub.ai/plugins/openclaw-ai-video-editor) |
| ClawHub skill (agentic) | [ai-agentic-video-editor](https://clawhub.ai/skills/ai-agentic-video-editor) |
| ClawHub skill (Levea brand) | [levea-ai-video-editor](https://clawhub.ai/skills/levea-ai-video-editor) |
| Sign up + API keys | [studio.livecore.ai](https://studio.livecore.ai/) |
| API base | `https://api.livecore.ai` |
| Renderer spec | [levea_renderer_spec.html](https://storage.googleapis.com/livecore-assets/decks/levea_renderer_spec.html) |
| Competitive positioning | [levea_positioning.html](https://storage.googleapis.com/livecore-assets/decks/levea_positioning.html) |

> Versions aren't pinned here — `npx -y levea-mcp-server` and the ClawHub listing always pull the latest.

**Support** — setup help, integration questions, or issue reports: `brajendrak00068@gmail.com`

**License** — MIT
