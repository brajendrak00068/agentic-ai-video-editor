# Levea — Agentic Video Production Platform

> **An agentic production environment for editable video.** Levea turns natural-language creative direction and source media into a structured video project, executes edits through typed production tools, verifies the result, and can render delivery files.

[![npm](https://img.shields.io/npm/v/levea-mcp-server?label=npm%20levea-mcp-server)](https://www.npmjs.com/package/levea-mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-levea--mcp--server-orange)](https://registry.modelcontextprotocol.io/v0/servers?search=levea-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> **Beta:** Agentic edits can be wrong. Preview every output before publishing or sharing it. For high-impact work, use `requirePlanApproval: true` so Levea returns its plan and waits for approval before execution.

Unlike a one-shot video generator, Levea maintains an editable project containing the timeline, layers, assets, captions, animation, audio, brand rules, and delivery requirements. Generative models are optional execution engines inside that workflow; they do not own the project state.

---

## Architecture

Levea separates probabilistic creative reasoning from deterministic project execution:

```text
               Creative Intent + Source Media
                            │
                            ▼
         Probabilistic Multimodal Intelligence
                    (Frontier Models)
                            │
                            ▼
          Typed Edit Graph / Media IR
                  (Scene Graph DAG)
                            │
                            ▼
         Deterministic Video-Production Harness
             ├── Timeline and Scene Graph
             ├── Media Operators
             ├── Caption and Layout Engine
             ├── Animation and Motion System
             ├── Generative Media Adapters
             ├── Renderer (Vulkan / WebGPU)
             ├── Validators
             ├── Project Versioning
             └── Export Pipeline
                            │
                            ▼
            Verification → Bounded Repair → Export
```

### 1. Multimodal planning

The planning layer interprets prompts, transcripts, project state, source footage, and visual references. It selects canonical editing actions and compiles them into a typed workflow DAG.

The hosted planner currently uses Gemini through Google AI or Vertex AI. The surrounding contracts are designed to remain provider-portable, and Claude, OpenAI, Cursor, Cline, OpenClaw, Hermes, and other MCP-capable systems can call Levea as clients.

### 2. Workflow DAG and Scene v4 IR

These are related but distinct structures:

- The **Workflow DAG** represents the ordered editing work, dependencies, execution state, verification requirements, and asynchronous jobs.
- The **Scene v4 IR** is the serializable media program: canvas, timeline, layers, timing, transforms, effects, captions, animation, audio, and asset references.

Keeping intent, execution, and renderable state separate makes edits inspectable, replayable, and independently repairable.

### 3. Deterministic production harness

Typed production operators apply the plan to the scene. Structural and perceptual verification runs during the workflow, and bounded repair can correct supported failures before the project is committed.

The renderer compiles Scene v4 compositions through native Vulkan and browser WebGPU paths. Cross-renderer parity is tested, but pixel-identical output should not be assumed for every effect or device.

### 4. Versioning and export

Scene revisions are stored as durable, linear undo/redo history backed by immutable scene payloads. This is not a Git branch-and-merge model: creating a new edit after undo replaces the forward redo chain.

Export is optional. A successful edit may return an updated editable scene, enqueue asynchronous media work, render an MP4, or produce a multi-platform bundle depending on the request.

---

## Quickstart

The portable integration is the [`levea-mcp-server`](https://www.npmjs.com/package/levea-mcp-server) MCP server.

### 1. Get an API key

Create an account at [studio.livecore.ai](https://studio.livecore.ai/) and generate a Levea API key.

### 2. Register the MCP server

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

`LEVEA_API_URL` must be the bare API host. Do not use `studio.livecore.ai` or append the route path; the client adds it automatically.

| Client | Setup |
| --- | --- |
| Claude Desktop, Cursor, or Cline | Add the configuration above to the client's MCP server settings. |
| Claude Code | `claude mcp add levea -e LEVEA_API_URL=https://api.livecore.ai -e LEVEA_API_KEY=... -- npx -y levea-mcp-server` |
| OpenClaw | Install `ai-agentic-video-editor`, or register the same command-based MCP server. |
| Hermes | Register `levea-mcp-server` using the included [`hermes-levea/mcp.json`](./hermes-levea/mcp.json). |

### 3. Describe the result

> Use Levea to turn this interview into three vertical clips. Tighten long pauses, add readable captions, keep the active speaker centred, add restrained motion graphics for the key statistics, and export the approved clips for Reels and Shorts.

Levea passes the complete brief to its editing planner. Calling clients should not split a multi-step creative request into many competing low-level edit calls.

---

## What you can ask for

| Request | Typical production path |
| --- | --- |
| “Make this clip vertical, remove silences, and add captions.” | Structural edit, audio cleanup, caption generation, safe-zone-aware reframe. |
| “Turn this podcast into five short highlights.” | Transcript and narrative analysis, segment selection, clip assembly, captioning, optional export bundle. |
| “Add lower thirds and animate the two key statistics.” | Transcript-aligned text, layout constraints, counters, charts, and motion-graphics layers. |
| “Replace the green screen and keep the speaker centred.” | Chroma key or available alpha matte, background composite, face-aware framing. |
| “Synchronise these camera angles and cut to the active speaker.” | Media alignment, diarisation, active-speaker selection, and timeline assembly. |
| “Apply our logo, colours, fonts, and caption style.” | Brand-kit lookup and deterministic styling across supported layer types. |
| “Blur background faces and bleep profanity.” | Face-region privacy effects, transcript-aligned audio cleanup, and verification. |
| “Generate B-roll for these product mentions.” | Transcript alignment plus stock or generative-media adapters when configured. |

---

## Capability status

Capability availability varies by deployment, enabled models, media type, and account limits. The categories below distinguish stable editing paths from optional or incomplete ones.

### Supported production paths

- **Project and timeline state:** Scene v4 projects, layer insertion and updates, grouping, trimming, splitting, sequencing, retiming, track-relative alignment, and durable undo/redo.
- **Captions and motion graphics:** automatic captions, word timing, keyword emphasis, caption templates, lower thirds, title cards, charts, counters, diagrams, Lottie, Rive, and procedural animation.
- **Layout and perception:** scene and shot analysis, face detection, active-speaker workflows, on-screen text-region detection, protected regions, social safe zones, and explicit-region tracking or masking.
- **Compositing:** chroma key, masks, blend modes, colour controls, adjustment layers, alpha-matte background replacement, and GPU effects.
- **Audio:** silence and filler-word cleanup, word-level muting, crossfades, EQ, denoise, loudness normalisation, limiting, music looping, and speech-aware ducking.
- **Verification:** typed task contracts, structural validation, perceptual checks where configured, requirement tracking, bounded repair, and partial-success reporting.
- **Rendering and delivery:** native Vulkan and browser WebGPU render paths, FFmpeg/NVENC-backed export where available, MP4 delivery, and multi-platform bundles.

### Model- or deployment-dependent

- Generated video, images, B-roll, music, sound effects, voiceover, and voice cloning.
- Neural alpha matting and background replacement quality.
- OCR **recognition** of visible text. Text-region detection can operate without the optional recognition model.
- Cross-asset identity search and other model-backed perception features.
- Perceptual review coverage and latency for long-running generation or rendering tasks.

---

## MCP tool surface

The MCP server exposes one high-level editing entry point plus typed management and polling tools:

| Group | Tools |
| --- | --- |
| Edit | `autonomous_edit`, `autonomous_edit_streaming`, `queue_edit` |
| Job and task polling | `check_job_status`, `check_task_status`, `get_active_task` |
| Caption templates | `list_caption_templates`, `apply_caption_template`, `save_caption_template`, `save_current_caption_template`, `delete_caption_template` |
| Brand kits | `list_brand_kits`, `get_brand_kit`, `create_brand_kit`, `update_brand_kit`, `delete_brand_kit` |
| Projects | `list_projects`, `get_project`, `create_project`, `delete_project` |
| Assets | `asset_upload_url`, `list_assets`, `delete_asset`, `transcribe_asset` |
| Diagnostics | `editor_health` |

Full MCP calling guidance, response contracts, approval semantics, and error handling are documented in [AGENTS.md](./AGENTS.md). The MCP server implementation has its own [package README](./mcp-server/README.md).

---

## Goals and creative briefs

`autonomous_edit` accepts both direct instructions and multi-step creative briefs.

Direct edit:

```text
Remove the opening dead air, add clean captions, and reframe vertically.
```

Open-ended goal:

```text
Review the opening 30 seconds and propose three stronger hooks.
```

Multi-step brief:

```text
Create a polished 45-second vertical highlight from this interview.

Keep the strongest self-contained explanation.
Tighten pauses without making the speech sound unnatural.
Keep the active speaker inside the vertical safe area.
Add captions and animate the two most important statistics.
Use our brand kit for typography, colours, and logo placement.
Add subtle music with speech-aware ducking.
Blur background faces.
Return the editable scene and export only after the plan is approved.
```

For propose-only behavior, pass `requirePlanApproval: true`. Levea returns `status: "awaiting_approval"` and `workingMemory`; resume with that state and an explicit approval message.

---

## HTTP API

Production host:

```text
https://api.livecore.ai
```

Authentication:

```http
Authorization: Bearer {LEVEA_API_KEY}
```

All paths below are under `/api/v1/misc/openclaw`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/execute` | Execute an edit and return JSON, or stream progress when SSE is requested. |
| `POST` | `/v1/queue-edit` | Queue an asynchronous edit and return a task identifier. |
| `GET` | `/v1/task-status/{taskId}` | Poll a queued editing task. |
| `GET` | `/v1/jobs/{jobId}` | Poll an asynchronous generation or export job. |
| `GET` | `/v1/projects/{projectId}/active-task` | Return the active task for a project. |
| `GET` | `/v1/export-events/{jobId}` | Read export progress events where available. |

Brand, project, asset, and caption-template management endpoints are also exposed as typed MCP tools.

### JSON request

```bash
curl -sS -X POST \
  "https://api.livecore.ai/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $LEVEA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "project_id": "my-project",
    "params": {
      "prompt": "Add readable captions and restrained motion graphics for the key statistics.",
      "requirePlanApproval": true
    }
  }'
```

### SSE progress

There is no separate `/v1/execute_streaming` route. Send the same request to `/v1/execute` with `Accept: text/event-stream`, `?stream=true`, or `"stream": true` in the body.

```bash
curl -N -X POST \
  "https://api.livecore.ai/api/v1/misc/openclaw/v1/execute" \
  -H "Authorization: Bearer $LEVEA_API_KEY" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "autonomous_edit",
    "params": {"prompt": "Create three captioned vertical highlights."}
  }'
```

Each SSE frame contains JSON in its `data:` field. Inspect the payload's `type`. Notable types include:

- Planning: `plan`, `phase`, `plan_preview`, `plan_approval_required`
- Execution: `step_start`, `step_progress`, `step_complete`, `tool_call`, `tool_result`
- Quality: `verification`, `repair`
- Async work: `background_job_started`, `export_progress`, `background_job_completed`
- Terminal state: `success`, `partial_success`, `error`

Do not treat task identifiers and export job identifiers as interchangeable; poll them through their corresponding endpoints.

---

## Safety and operational notes

- Treat mutating calls as potentially long-running and expensive. Poll returned task or job identifiers instead of repeating an edit request.
- Identical concurrent requests may be deduplicated server-side; clients should still use stable request identifiers and backoff on transient failures.
- Read-only inspection does not require export. Mutating calls may auto-export depending on the route and workflow.
- Verification reduces known structural and perceptual failures; it does not guarantee editorial correctness, legal compliance, or suitability for publication.
- Never place `LEVEA_API_KEY` in source control. Rotate a key immediately if it is exposed.

### Typical media formats

| Direction | Formats |
| --- | --- |
| Video input | MP4, MOV, WebM via supported URLs or uploaded assets |
| Image input | JPG, PNG, WebP |
| Audio input | MP3, WAV, M4A, AAC, or audio extracted from video |
| Output | MP4 and ZIP bundles for supported multi-output workflows |

Account, duration, resolution, provider, rate, and quota limits can vary by deployment and plan.

---

## Links

| Resource | Link |
| --- | --- |
| Levea Studio and API keys | [studio.livecore.ai](https://studio.livecore.ai/) |
| npm MCP server | [`levea-mcp-server`](https://www.npmjs.com/package/levea-mcp-server) |
| MCP Registry | [`io.github.brajendrak00068/levea-mcp-server`](https://registry.modelcontextprotocol.io/v0/servers?search=levea-mcp-server) |
| OpenClaw plugin | [`openclaw-ai-video-editor`](https://clawhub.ai/plugins/openclaw-ai-video-editor) |
| OpenClaw skill | [`ai-agentic-video-editor`](https://clawhub.ai/skills/ai-agentic-video-editor) |
| Agent integration guide | [AGENTS.md](./AGENTS.md) |
| MCP package documentation | [mcp-server/README.md](./mcp-server/README.md) |

Support: `brajendrak00068@gmail.com`

## License

[MIT](./LICENSE)
