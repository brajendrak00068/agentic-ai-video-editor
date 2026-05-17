# OpenClaw AI Video Editor

> **An autonomous agentic video editor.** Send a sentence. Get a finished video. No timelines, no keyframes, no plugin chains.

[![ClawHub](https://img.shields.io/badge/ClawHub-plugin-blue)](https://clawhub.ai/plugins/openclaw-ai-video-editor)
[![npm](https://img.shields.io/npm/v/openclaw-ai-video-editor)](https://www.npmjs.com/package/openclaw-ai-video-editor)

> **Beta.** The agent can make mistakes. Preview every output before publishing or sharing. For high-stakes or irreversible edits, pass `requirePlanApproval: true` so the agent stops after planning and waits for your approval before anything runs.

---

## Beyond one-liners: goals and briefs

`autonomous_edit` accepts anything from a five-word command to a five-hundred-word creative brief. Three flavors:

### 1. Direct commands

Single edit, single result:

```text
"Generate captions and remove silences"
"Reframe to 9:16 for TikTok"
"Color grade like a Netflix doc"
```

### 2. Open-ended goals (watch and propose)

Hand the agent a *goal* instead of a command and it inspects the asset, then proposes a plan:

```text
"Watch this and tell me how to make it more engaging for TikTok"
"Look at the first 30 seconds and suggest 3 ways to hook the viewer"
"Review this footage and propose edits to tighten the pacing"
```

Pair these with `requirePlanApproval: true` to keep the agent in propose-only mode — it stops after planning, returns the full plan, and waits for your approval before executing anything.

### 3. Full creative briefs

Multi-step orchestrations executed end-to-end. The agent decomposes the brief into a DAG of canonical actions, plans the order, executes through safety gates, verifies each step, and exports every requested format. Use SSE to watch each step land in real time.

```bash
curl -sS -X POST "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $ADSCENE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {
      "prompt": "Transform this video into a viral social media documentary. Start by trimming the first 3 seconds and last 5 seconds to remove dead air. Apply a cinematic color grade with warm tones and high contrast. Generate auto-captions with bold yellow text and black outline, positioned at the bottom center. Add a dynamic zoom-in effect on the main subject during the first 10 seconds. Insert 3 contextual b-roll clips at moments where the speaker mentions visual concepts. Apply face tracking to keep the subject centered when converting to vertical 9:16 format for TikTok and Instagram Reels. Add an upbeat background music track that matches the energy, with auto-ducking when the speaker talks. Remove all silence gaps longer than 0.5 seconds to tighten pacing. Apply a subtle vignette effect around the edges. Add my logo watermark in the top right corner with 80% opacity. Generate a custom thumbnail with the most expressive frame and bold text overlay saying MUST WATCH. Create an animated subscribe button that appears at 5 seconds and pulses. Add sound effects for emphasis at key moments - use whoosh sounds for transitions. Apply noise reduction to clean up the audio. Split the video at 30 seconds to insert a 2-second transition effect. Add text overlays for key statistics mentioned in the video with animated counter effects. Apply motion tracking to blur any faces in the background for privacy. Export the final video in 1080p for YouTube and also create optimized versions for TikTok, Instagram Reels, and YouTube Shorts with platform-specific aspect ratios and durations."
    },
    "project_id": "my-project"
  }'
```

That single call composes ~20 canonical actions in one planned run. No timeline UI, no per-step API calls, no glue code on your side.

---

## What you can do with it

| You ask | It does |
|---|---|
| "Turn this into 5 viral clips with captions and vertical reframe" | Picks the best moments, cuts, captions, reframes, and exports |
| "Cut a 60-second highlight from this 2-hour podcast" | Identifies narrative peaks, trims, packages with captions |
| "Make this TikTok-ready" | Vertical 9:16 reframe + captions + silence removal + emphasis kit |
| "Export for TikTok, Reels, Shorts, YouTube, and Instagram" | One pass, all aspect ratios in one bundle |
| "Replace the green screen with a beach, keep the speaker centered" | Chroma key + background composite + motion tracking in one call |
| "Remove the background from this video — no green screen" | AI background removal via alpha matte (works on any footage) |
| "Blur the background, keep me in focus" | AI background blur (subject-aware) |
| "Remove the logo from this frame" | Object removal *(roadmap — mask + inpaint)* |
| "Remove all silences and filler words, add background music" | Cleans the audio track, adds ducked music under speech |
| "Auto-zoom on whoever's talking" | Active-speaker detection + dynamic zoom-follow framing |
| "Generate captions and highlight every time they say 'launch'" | Auto-captions + keyword emphasis with scaling / glow / pulse |
| "Find every clip where Alex appears" | Cross-asset face identity search |
| "Generate a thumbnail for this video" | AI thumbnail extraction at the best frame |
| "Add narration in a cloned voice over the intro" | Voice cloning + TTS overlay + auto-ducking |
| "Cut to the beat of this track" | Provide BPM or beat times — cuts align automatically |
| "Generate B-roll over the product mention" | AI B-roll generation + placement at the right timestamp |
| "Blur all faces except the speaker" | Face detection + selective blur |
| "Add my logo as a watermark in the corner" | Branding overlay from gallery or AI-generated |
| "Color grade this like a Netflix doc" | Color grading with cinematic preset |
| "Slow-mo the climax, freeze on the reveal" | Retime with ramp curves + freeze-frame |
| "Generate chapter titles from the on-screen text" | OCR-driven chapter generation |
| "Reframe to vertical but don't crop off the lower-third captions" | Caption-safe 9:16 reframe (preserves on-screen text) |
| "What text is on screen at 0:42?" | On-screen text extraction (OCR) |
| "Sync my voiceover to the video and duck the music" | Audio sync + auto-ducking |

That's the headline. Below is the full surface.

> **Beta caveat**: outputs sometimes need a second pass. Preview before publishing; for anything you can't undo, approve the plan first using the [plan approval flow](#plan-approval-flow).

---

## Made for

- **Creators & influencers** — turn long videos into TikToks, Reels, Shorts; auto-captions; viral-clip generation; AI thumbnails
- **Podcasters** — video-podcast highlights, audiograms, multi-cam podcast editing, silence and filler-word removal
- **Marketers & agencies** — ad creation at scale, social-first repurposing, brand-overlay automation, multi-platform exports
- **Educators & course creators** — tutorial editing, auto-chapters, OCR'd slide titles, auto-captions, word-level emphasis
- **YouTubers** — long-form → Shorts pipeline, thumbnail generation, intro / outro automation, chapter markers
- **Sales & SaaS** — product demos, walkthrough highlights, voiceover narration with cloned voices
- **Event teams** — webinar / conference highlights, multi-cam stitching, speaker spotlight reels
- **Faith & community** — sermon clips for social, message highlights, multi-platform packaging

---

## Capability surface

### Read & inspect
- Inspect the timeline structure, layer properties, and scene state
- Search the asset gallery by type, duration, name
- Run computer-vision analysis on frames (object, face, scene)
- **Extract on-screen text** — OCR of chyrons, lower-thirds, slide titles, captions burned into source
- Search the transcript by keyword, semantic meaning, or timestamp window
- Pull video intelligence — narrative peaks, speaker diarization, sentiment, pacing
- Poll async job status, introspect tool / schema metadata

### Structural editing
- Insert / update / replace / delete layers — **video, audio, text, image, shape, group, adjustment**
- Trim, split, retime — slow-motion (0.5×), fast-forward (2×), freeze-frame, ramp curves
- Reposition, sequence, snap to transcript word boundaries
- Heal timeline gaps, normalize audio, reconcile durations (pre-export safety pass)
- Multi-step undo / redo

### Visual editing
- **Color grading** — brightness, contrast, saturation, hue, lift / gamma / gain, RGB curves
- **Procedural VFX shaders** — smoke, dust, fire, explosion, lightning, snow, glitch, scanlines, grain, glassmorphism, bokeh, lava, telomere / corrosion, portal
- **Chroma key** — green / blue screen with similarity, smoothness, spill suppression
- **AI background removal** — alpha matte (works on any video, no green screen required)
- **AI background blur** — subject-aware depth blur
- **Object removal** — *(roadmap)* AI mask + inpaint
- **Masking** — luma, alpha, depth masks
- **Geometric clip shapes** — circle, dome, star, hexagon, polygon
- **Crop** — absolute or edge-based; **3D rotation + perspective**
- **Glow, shadow, inner shadow, gradient fills, text gradients**
- **Vertical reframe** (9:16) and vertical-reframe montage — **caption-safe** (avoids cropping through on-screen text and chyrons)
- **Split screen** — top/bottom, left/right, picture-in-picture, grid
- **Branding overlays** — logo / watermark from gallery or AI-generated
- **Motion / face tracking** with dynamic zoom-follow framing

### Captions & text
- Auto-generate captions from the transcript
- Style captions with built-in templates **or** an AI director that picks / generates a custom template at runtime
- **Curved text paths** — circle, wave, custom SVG
- **Per-word animations** — typewriter, slide, fade, scale, rotate, bounce, flip, swing, elastic, blur, glitch, wave (each with matching exit)
- Lottie animation playback control

### Audio
- Clean audio — remove **silences, breaths, filler words**; word-level mute / cut
- **Auto-ducking** on speech detection (sidechain music vs voice)
- Mix / normalize / denoise / EQ (bass-boost, vocal-clarity, warm, bright presets)
- Sync external master audio to video (offset, mute camera audio)
- **Beat-synced cuts** — provide `beat_times` or `bpm`, the editor aligns cuts
- Add SFX
- Generate music (mood / genre / BPM)
- Generate voiceover (TTS or cloned voice)
- Render waveform visualizers (bars, wave, circular)

### Async generation
- **AI video / B-roll** — duration + aspect ratio
- **AI images** — single or batch at timestamps
- **AI music** — prompt + duration + mood + genre + BPM
- **AI voiceover** — TTS or cloned voice library
- **Auto-thumbnail extraction**
- **Face blur** — all faces or background-only
- **Image edit** — generative instruction-based

### High-level presets
Each preset bundles many underlying edits into a single call:

| Preset | What it does |
|---|---|
| Viral preset | Vertical reframe + captions + silence removal + motion tracking + word emphasis |
| Cinematic director | Dynamic zooms + cinematic color grade + mood-based camera moves |
| Emphasis system | Keyword detection + coordinated scaling / glow / pulse with captions |
| Pacing optimizer | Filler-word + silence + low-energy segment removal for retention |

### Export
| Capability | Output |
|---|---|
| MP4 export | Single MP4 (resolution / codec / quality tier) |
| Viral clip batch | Auto-segmented short-form clips packaged as ZIP |
| Multi-platform pack | TikTok + Reels + Shorts + YouTube + Instagram aspect ratios in one pass |

---

## How you use it

Every edit goes through one tool: **`autonomous_edit`**. Pass a natural-language description of what you want and the agent plans, executes, verifies, and exports — no tool list to memorize, no structured params to learn.

```bash
curl -sS -X POST "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $ADSCENE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {
      "prompt": "Make this a TikTok-ready viral clip: vertical reframe, add bold captions, remove silences, motion-track the speaker, and export."
    },
    "project_id": "my-project"
  }'
```

Anything in the [capability surface](#capability-surface) above is reachable from a prompt. Mix and match: chroma key + background replace + caption + emphasis in a single sentence works.

---

## Quick start

### 1. Get an API key

Sign up at [https://studio.livecor.ai/](https://studio.livecor.ai/) and generate an OpenClaw API key from the account UI.

### 2. Install the plugin

```bash
openclaw plugins install clawhub:openclaw-ai-video-editor
```

Or via npm:

```bash
npm install openclaw-ai-video-editor
```

### 3. Configure

```bash
export ADSCENE_API_URL="https://api.livecore.ai"
export ADSCENE_API_KEY="your-openclaw-api-key"
```

Or in OpenClaw skill config:

```json
{
  "skills": {
    "entries": {
      "openclaw_ai_video_editor": {
        "enabled": true,
        "env": {
          "ADSCENE_API_URL": "https://api.livecore.ai",
          "ADSCENE_API_KEY": "your-openclaw-api-key"
        }
      }
    }
  }
}
```

### 4. Run an autonomous edit

```bash
curl -sS -X POST "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $ADSCENE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {
      "prompt": "Generate 5 viral clips, 15-30 seconds each, focused on the most engaging moments. Add bold captions, vertical reframe, remove silences."
    },
    "project_id": "my-project"
  }'
```

---

## API surface

Base URL: `{ADSCENE_API_URL}` (production: `https://api.livecore.ai`)

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/misc/openclaw/v1/execute` | Run `autonomous_edit` or a deterministic tool |
| `GET /api/v1/misc/openclaw/v1/jobs/{jobId}` | Poll async render or generation jobs |
| `GET /api/v1/misc/openclaw/v1/tools` | List available tool names |
| `GET /api/v1/misc/openclaw/v1/health` | Health check |

Auth header:

```http
Authorization: Bearer {ADSCENE_API_KEY}
```

Do **not** set `ADSCENE_API_URL` to `https://studio.livecor.ai` or the in-product editor route `/api/v1/misc/editor/`. Studio is the user-facing app; OpenClaw requests go to the API-key route on `https://api.livecore.ai`.

### Request body

```json
{
  "tool": "autonomous_edit",
  "params": { "prompt": "<natural-language edit>" },
  "project_id": "optional",
  "scene": { }
}
```

### JSON response

```json
{
  "type": "success" | "partial_success",
  "tool": "<tool-name>",
  "success": true,
  "status": "completed" | "failed" | "awaiting_approval",
  "scene": { },
  "reply": "Human-readable summary of what changed",
  "videoUrl": "https://.../output.mp4",
  "jobId": "task_...",
  "viral_clips": [ ],
  "zip_url": "https://.../clips.zip",
  "activeTasks": [ ],
  "pendingAsyncJobs": [ ],
  "verificationPassed": true,
  "verificationIssues": [],
  "processingTime": 12.3,
  "workingMemory": { }
}
```

### SSE streaming

Set `Accept: text/event-stream` or `?stream=true`. Notable event types:

| Event | Meaning |
|---|---|
| `heartbeat` | 15s keepalive |
| `status` | Phase transitions |
| `thinking`, `tool_call`, `tool_result` | Per-step reasoning visibility |
| `background_job_completed` | Async job done |
| `success` / `partial_success` | Terminal payload |
| `error` | Terminal failure |

### Async job lifecycle

Generation actions return immediately with a `jobId`. Poll:

```bash
curl -sS "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/jobs/$JOB_ID" \
  -H "Authorization: Bearer $ADSCENE_API_KEY"
```

### Auto-export

After any **mutating** tool call, if the scene actually changed and an export isn't already queued, the route auto-fires one as a second run. Read-only and conversational `autonomous_edit` calls do **not** trigger auto-export.

### Plan approval flow

Pass `requirePlanApproval: true` to make the agent stop after planning. It returns `status: "awaiting_approval"` + populated `workingMemory`. Resume by sending the same `workingMemory` with an approval prompt (`yes`, `approve`, `go`, `do it`, `confirm`).

---

## How this differs from legacy editors

| | Legacy editors (Premiere, DaVinci, CapCut, Descript) | OpenClaw AI Video Editor |
|---|---|---|
| **Interface** | Drag, drop, keyframe by hand | One sentence; the agent does the rest |
| **Auto-analysis on upload** | Manual scene detection, manual subtitles | Faces, speakers, shots, on-screen text, mattes all detected automatically |
| **"Make this viral"** | You build the workflow | Single preset — vertical + captions + silences + tracking, done |
| **Cross-asset search** | Filename search | "Find every clip where Alex appears" — works across the whole library |
| **Background replace** | Key out manually, find background, composite | One call |
| **Beat-synced cuts** | Mark beats by hand | Provide `beat_times` or `bpm`; cuts align automatically |
| **Editorial reasoning** | You decide what's the climax | Agent surfaces narrative peaks and reaction moments |
| **Verification** | You eyeball the result | Verifier runs after execution; auto-repairs on failure |
| **Multi-platform export** | One render per aspect ratio | TikTok + Reels + Shorts + YouTube + Instagram in one pass |
| **Extensibility** | Plugins call external binaries | Typed tools called by name |

This isn't an editor with AI features bolted on. It's an autonomous agent that finishes the edit for you.

---

## Safety & limits

- **Currently in beta** — outputs can be wrong. Preview every result before sharing or publishing. For irreversible workflows, pass `requirePlanApproval: true` to inspect and approve the plan before any edit runs.
- API-key authentication on every request
- Destructive actions (mass deletes, clears) require explicit confirmation params
- Output is verified after execution; auto-repairs on failure
- Concurrent identical requests are deduplicated server-side
- Rate-limited per API key. Read-only ~1–3s, structural edits ~3–10s, async generation 30s–5min per artifact, viral-clip / multi-platform exports several minutes

---

## Supported media

| | Formats |
|---|---|
| **Video in** | MP4, MOV, WebM (HTTP/HTTPS URLs, YouTube URLs, gallery IDs) |
| **Image in** | JPG, PNG, WebP |
| **Audio in** | MP3, WAV, M4A, AAC (or extracted from video) |
| **Output** | MP4 (export), ZIP (viral clips / multi-platform bundles) |
| **Max video length** | Up to **3 hours** per asset (plan-dependent). Synchronous edits and async generation both supported. |
| **Recommended resolution** | 1080p or 4K; canvas is configurable per project |

---

## End-to-end example: viral-clip generation

```bash
# 1) Kick off the viral-clip pipeline
curl -sS -X POST "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $ADSCENE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {
      "prompt": "Generate 5 viral clips, 15-30 seconds each, focused on the most engaging moments. Add bold captions, vertical reframe, remove silences."
    },
    "project_id": "my-project"
  }' | tee /tmp/result.json | jq -r '.jobId // .activeTasks[0].intent.job_id'

# 2) Poll job status until done
JOB_ID=$(jq -r '.jobId // .activeTasks[0].intent.job_id' /tmp/result.json)
while true; do
  STATUS=$(curl -sS "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/jobs/$JOB_ID" \
    -H "Authorization: Bearer $ADSCENE_API_KEY" | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# 3) Fetch the final artifact URLs
curl -sS "$ADSCENE_API_URL/api/v1/misc/openclaw/v1/jobs/$JOB_ID" \
  -H "Authorization: Bearer $ADSCENE_API_KEY" | jq '.result'
```

---

## Links

- **ClawHub plugin** — [clawhub.ai/plugins/openclaw-ai-video-editor](https://clawhub.ai/plugins/openclaw-ai-video-editor)
- **ClawHub skill (agentic)** — [clawhub.ai/skills/ai-agentic-video-editor](https://clawhub.ai/skills/ai-agentic-video-editor)
- **ClawHub skill (Levea brand)** — [clawhub.ai/skills/levea-ai-video-editor](https://clawhub.ai/skills/levea-ai-video-editor)
- **npm** — [npmjs.com/package/openclaw-ai-video-editor](https://www.npmjs.com/package/openclaw-ai-video-editor)
- **Sign up + API keys** — [studio.livecor.ai](https://studio.livecor.ai/)
- **API base** — `https://api.livecore.ai`

## Support

Setup help, integration questions, or issue reports — `brajendrak00068@gmail.com`

## License

MIT
