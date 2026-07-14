#!/usr/bin/env node
/**
 * Levea AI Video Editor — MCP server.
 *
 * Exposes the autonomous video editor + its surrounding management APIs
 * (caption templates, brand kits, projects, assets, async queue) to any MCP
 * client (Claude Desktop, Claude Code, Cursor, Cline, OpenClaw, Hermes, …)
 * over stdio.
 *
 * Architectural posture — **one edit tool, many management tools**:
 *   - `autonomous_edit` is the SOLE editing entry point. The backend planner
 *     owns intent decomposition, action selection, verification, and export.
 *     We deliberately do NOT expose per-capability shims (`add_captions`,
 *     `generate_viral_clips`, …) because they fragment the planner's visibility.
 *   - All OTHER tools are read-only diagnostics or state-management CRUD
 *     (brand kits, projects, assets, caption templates). They never mutate
 *     scene state directly — that path stays gated through autonomous_edit.
 *
 * Config (env, set via the MCP client's `mcpServers` entry):
 *   LEVEA_API_URL   e.g. https://api.livecore.ai   (required)
 *   LEVEA_API_KEY   from https://studio.livecore.ai/ (required)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  execute,
  executeStreaming,
  getJobStatus,
  waitForJob,
  health,
  listCaptionTemplates,
  saveCaptionTemplate,
  saveCurrentCaptionTemplate,
  applyCaptionTemplate,
  deleteCaptionTemplate,
  queueEdit,
  getTaskStatus,
  getActiveTask,
  listBrandKits,
  getBrandKit,
  createBrandKit,
  updateBrandKit,
  deleteBrandKit,
  listProjects,
  getProject,
  createProject,
  deleteProject,
  assetUploadUrl,
  listAssets,
  deleteAsset,
  transcribeAsset,
  type ExecuteResult,
  type ExecuteArgs,
  type SSEEvent,
} from './client';

const PKG_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require('../package.json') as { version: string }).version;

// ───────────────────────────────────────────────────────────────────────────
// Tool schemas
// ───────────────────────────────────────────────────────────────────────────

const AUTONOMOUS_EDIT_SCHEMA = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description:
        'Natural-language description of the desired edit or creative brief. ' +
        'The backend planner decomposes it into canonical actions (viral clips, captions, reframe, export, …). ' +
        'Send the user\'s intent verbatim — do not pre-decompose into multiple calls.',
    },
    project_id: { type: 'string', description: 'Optional project id for tracking / continuity.' },
    video_url: {
      type: 'string',
      description: 'Optional source video URL. Auto-seeded as the starting layer when no scene is provided.',
    },
    assets: {
      type: 'array',
      description:
        'Optional asset descriptors. Each item: { id?, type: "video"|"image"|"audio", url|src, mimeType?, duration? }.',
      items: { type: 'object' },
    },
    scene: {
      type: 'object',
      description: 'Optional existing scene/timeline state to continue editing (advanced).',
    },
    requirePlanApproval: {
      type: 'boolean',
      description:
        'If true, the agent stops after planning and returns { status: "awaiting_approval", workingMemory, plan } without mutating. ' +
        'Resume by re-calling with the returned workingMemory + an approval prompt ("yes", "approve", "do it").',
    },
    workingMemory: {
      type: 'object',
      description:
        'Working-memory snapshot returned by a prior call (typically one that returned awaiting_approval). Re-sending resumes that run.',
    },
    attachedImages: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional base64-encoded reference images the agent should consider while planning.',
    },
    flaggedIssues: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional list of specific user-flagged problems for this run (e.g. ["caption #3 misspelled"]).',
    },
    captionTemplatePreset: {
      type: 'string',
      description:
        'Optional caption template slug to apply when (re)generating captions. ' +
        'One of 41 builtins (hormozi, mrbeast, viral-pop, minimal-pro, karaoke, neon-pop, typewriter, pop-wave, subtitle-bar, creator-box, …) or a user-saved template id from list_caption_templates.',
    },
    captionTemplateMode: {
      type: 'string',
      enum: ['add', 'recreate', 'style', 'translate', 'clear', 'remove_fillers'],
      description: 'How to apply captionTemplatePreset.',
    },
    core_only: {
      type: 'boolean',
      description: 'If true, response carries only rendering-essential scene fields (no debug metadata).',
    },
    brandId: {
      type: 'string',
      description:
        'Optional brand-profile id to apply for this call (palette, fonts, logo, voice, gradeBias). ' +
        'Look up ids via list_brand_kits. Overrides project default brand.',
    },
    projectBrandId: {
      type: 'string',
      description: 'Optional default brand for the project. Persists; per-call brandId overrides.',
    },
    editedPlan: {
      type: 'object',
      description: 'Optional pre-edited plan object returned by a prior awaiting_approval response.',
    },
  },
  required: ['prompt'],
} as const;

export const TOOLS: Tool[] = [
  // ── Editing — single tool ────────────────────────────────────────────────
  {
    name: 'autonomous_edit',
    description:
      'PRIMARY EDIT TOOL. Run a natural-language video edit end-to-end. The backend agent plans, executes, verifies, and exports. Accepts anything from a one-liner ("generate 3 viral clips with captions and export") to a multi-paragraph creative brief. Returns the final mp4 URL synchronously when an export is queued. For long renders you may prefer queue_edit + check_job_status.',
    inputSchema: AUTONOMOUS_EDIT_SCHEMA as unknown as Tool['inputSchema'],
  },
  {
    name: 'autonomous_edit_streaming',
    description:
      'Same as autonomous_edit but consumes the SSE event stream from the backend. Returns the final terminal result; per-step events (status, thinking, tool_call, tool_result, background_job_completed) are emitted as MCP progress notifications when the client supports them. Use for long-running briefs where users expect live progress.',
    inputSchema: AUTONOMOUS_EDIT_SCHEMA as unknown as Tool['inputSchema'],
  },
  {
    name: 'queue_edit',
    description:
      'Fire-and-forget async path. Returns immediately with a `taskId`. Use when the edit may exceed the MCP request timeout (long viral-clip generation, multi-format export). Poll with check_task_status or get_active_task.',
    inputSchema: AUTONOMOUS_EDIT_SCHEMA as unknown as Tool['inputSchema'],
  },

  // ── Job / task polling ───────────────────────────────────────────────────
  {
    name: 'check_job_status',
    description: 'Poll an export / async job by jobId (numeric). Supports wait:true to block until terminal.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job id to poll (numeric).' },
        wait: { type: 'boolean', description: 'Block until terminal state.' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'check_task_status',
    description: 'Poll a queued edit task by taskId (returned by queue_edit). Separate from job_id (exports).',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'Task id from queue_edit.' } },
      required: ['task_id'],
    },
  },
  {
    name: 'get_active_task',
    description: 'For a given project, return the currently-running edit task (if any). Useful for reconnecting MCP clients.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project id.' } },
      required: ['project_id'],
    },
  },

  // ── Caption templates ────────────────────────────────────────────────────
  {
    name: 'list_caption_templates',
    description: 'List the user\'s caption templates (builtin + saved). Returns slugs, display names, and style summaries.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'apply_caption_template',
    description: 'Apply a caption template to a scene synchronously (without going through autonomous_edit).',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template slug / id from list_caption_templates.' },
        project_id: { type: 'string', description: 'Project / scene id to apply to.' },
        scene: { type: 'object', description: 'Inline scene (alternative to project_id).' },
        mode: { type: 'string', enum: ['add', 'recreate', 'style', 'translate', 'clear', 'remove_fillers'] },
      },
      required: ['template_id'],
    },
  },
  {
    name: 'save_caption_template',
    description: 'Save a new caption template definition the user can re-apply later.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name.' },
        style: { type: 'object', description: 'Style payload (font, color, position, animation, etc.).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
      },
      required: ['name', 'style'],
    },
  },
  {
    name: 'save_current_caption_template',
    description: 'Snapshot the caption styling currently applied to a project / scene as a reusable template.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project to snapshot from.' },
        name: { type: 'string', description: 'Template display name.' },
        scene: { type: 'object', description: 'Inline scene (alternative to project_id).' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_caption_template',
    description: 'Delete a user-saved caption template by id.',
    inputSchema: {
      type: 'object',
      properties: { template_id: { type: 'string' } },
      required: ['template_id'],
    },
  },

  // ── Brand kits ───────────────────────────────────────────────────────────
  {
    name: 'list_brand_kits',
    description: 'List the user\'s brand profiles (palette, fonts, logo, voice, gradeBias). Returns ids you pass to autonomous_edit\'s brandId / projectBrandId.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_brand_kit',
    description: 'Fetch one brand profile by id.',
    inputSchema: {
      type: 'object',
      properties: { brand_id: { type: 'string' } },
      required: ['brand_id'],
    },
  },
  {
    name: 'create_brand_kit',
    description: 'Create a brand profile. Fields: name, palette {primary,secondary,accent,neutral,extras[]}, fonts {primary,secondary}, gradeBias (warm/cool/neutral/vivid/muted), forbiddenColors[], logoAssetUrl, voiceTone, enforcement (soft|hard).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        palette: { type: 'object' },
        fonts: { type: 'object' },
        gradeBias: { type: 'string', enum: ['warm', 'cool', 'neutral', 'vivid', 'muted'] },
        forbiddenColors: { type: 'array', items: { type: 'string' } },
        logoAssetUrl: { type: 'string' },
        voiceTone: { type: 'string' },
        enforcement: { type: 'string', enum: ['soft', 'hard'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_brand_kit',
    description: 'Update an existing brand profile by id. Body has the same shape as create_brand_kit.',
    inputSchema: {
      type: 'object',
      properties: {
        brand_id: { type: 'string' },
        name: { type: 'string' },
        palette: { type: 'object' },
        fonts: { type: 'object' },
        gradeBias: { type: 'string' },
        forbiddenColors: { type: 'array', items: { type: 'string' } },
        logoAssetUrl: { type: 'string' },
        voiceTone: { type: 'string' },
        enforcement: { type: 'string' },
      },
      required: ['brand_id'],
    },
  },
  {
    name: 'delete_brand_kit',
    description: 'Delete a brand profile.',
    inputSchema: {
      type: 'object',
      properties: { brand_id: { type: 'string' } },
      required: ['brand_id'],
    },
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  {
    name: 'list_projects',
    description: 'List the user\'s projects.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_project',
    description: 'Fetch one project by id.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project. Optional initial brandId.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        brandId: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },

  // ── Assets ───────────────────────────────────────────────────────────────
  {
    name: 'asset_upload_url',
    description: 'Get a signed upload URL for a local file (so users do not have to host video / image / audio elsewhere before passing video_url to autonomous_edit). Body: { fileName, fileType?, contentType?, projectId? }. Returns { uploadUrl, fileUrl }; PUT the file bytes to uploadUrl, then pass fileUrl to autonomous_edit as video_url / in assets[].',
    inputSchema: {
      type: 'object',
      properties: {
        fileName: { type: 'string' },
        fileType: { type: 'string', description: 'video | image | audio (heuristic from extension if omitted).' },
        contentType: { type: 'string', description: 'MIME type, e.g. video/mp4.' },
        projectId: { type: 'string', description: 'Optional project to associate the asset with.' },
      },
      required: ['fileName'],
    },
  },
  {
    name: 'list_assets',
    description: 'List the user\'s uploaded assets. Optional projectId filter.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        fileType: { type: 'string', description: 'Optional filter: video|image|audio.' },
      },
      required: [],
    },
  },
  {
    name: 'delete_asset',
    description: 'Delete an asset by file name (the path returned by asset_upload_url).',
    inputSchema: {
      type: 'object',
      properties: { fileName: { type: 'string' } },
      required: ['fileName'],
    },
  },
  {
    name: 'transcribe_asset',
    description: 'Force transcription of an existing asset. Returns transcript words + timing.',
    inputSchema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', description: 'Asset path.' },
        language: { type: 'string', description: 'Optional ASR language hint.' },
      },
      required: ['fileName'],
    },
  },

  // ── Diagnostics ──────────────────────────────────────────────────────────
  {
    name: 'editor_health',
    description: 'Connectivity diagnostic against LEVEA_API_URL. Unauthenticated.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function pickExecuteArgs(a: Record<string, unknown>): ExecuteArgs {
  const params: Record<string, unknown> = { prompt: a.prompt };
  if (a.video_url) params.video_url = a.video_url;
  if (Array.isArray(a.assets) && a.assets.length > 0) params.assets = a.assets;
  const out: ExecuteArgs = {
    tool: 'autonomous_edit',
    params,
    project_id: str(a.project_id),
    scene: a.scene,
  };
  if (a.requirePlanApproval !== undefined) out.requirePlanApproval = !!a.requirePlanApproval;
  if (a.workingMemory !== undefined) out.workingMemory = a.workingMemory as Record<string, unknown>;
  if (Array.isArray(a.attachedImages)) out.attachedImages = a.attachedImages as string[];
  if (Array.isArray(a.flaggedIssues)) out.flaggedIssues = a.flaggedIssues as string[];
  if (a.captionTemplatePreset) out.captionTemplatePreset = String(a.captionTemplatePreset);
  if (a.captionTemplateMode) out.captionTemplateMode = String(a.captionTemplateMode);
  if (a.core_only !== undefined) out.core_only = !!a.core_only;
  if (a.brandId) out.brandId = String(a.brandId);
  if (a.projectBrandId) out.projectBrandId = String(a.projectBrandId);
  if (a.editedPlan !== undefined) out.editedPlan = a.editedPlan as Record<string, unknown>;
  return out;
}

function summarizeExec(r: ExecuteResult): string {
  const head = r.success ? '✅' : '❌';
  const lines = [`${head} ${r.message || r.reply || (r.success ? 'Done' : 'Failed')}`];
  if (r.videoUrl) lines.push(`📹 ${r.videoUrl}`);
  if (r.jobId !== undefined) lines.push(`🆔 job ${r.jobId}`);
  if (r.status) lines.push(`status: ${r.status}`);
  return lines.join('\n');
}

function ok(text: string, structured: unknown) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: structured as Record<string, unknown>,
  };
}
function fail(text: string, structured?: unknown) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: (structured as Record<string, unknown>) ?? { error: text },
    isError: true,
  };
}

function summarizeAny(label: string, data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.success === false) return `❌ ${label} failed: ${d.error || d.message || 'unknown'}`;
    const count =
      Array.isArray((d as any).items) ? (d as any).items.length :
      Array.isArray((d as any).templates) ? (d as any).templates.length :
      Array.isArray((d as any).brands) ? (d as any).brands.length :
      Array.isArray((d as any).projects) ? (d as any).projects.length :
      Array.isArray((d as any).assets) ? (d as any).assets.length :
      Array.isArray((d as any).data) ? ((d as any).data as unknown[]).length :
      undefined;
    return count !== undefined ? `✅ ${label}: ${count} item(s)` : `✅ ${label}`;
  }
  return `✅ ${label}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Dispatcher
// ───────────────────────────────────────────────────────────────────────────

interface DispatchCtx {
  notifyProgress?: (progress: number, total?: number, message?: string) => Promise<void>;
}

async function dispatch(name: string, a: Record<string, unknown>, ctx: DispatchCtx) {
  switch (name) {
    case 'autonomous_edit': {
      if (!str(a.prompt)) return fail('❌ `prompt` is required for autonomous_edit.');
      const r = await execute(pickExecuteArgs(a));
      return ok(summarizeExec(r), r);
    }

    case 'autonomous_edit_streaming': {
      if (!str(a.prompt)) return fail('❌ `prompt` is required for autonomous_edit_streaming.');
      const events: SSEEvent[] = [];
      let stepN = 0;
      const r = await executeStreaming(pickExecuteArgs(a), (ev) => {
        events.push(ev);
        const dataObj = (typeof ev.data === 'object' ? ev.data : { raw: ev.data }) as Record<string, unknown>;
        const typeStr = String(ev.event || dataObj.type || 'event');
        // Emit progress notifications to the MCP client (when supported).
        const msg =
          (dataObj.message as string | undefined) ||
          (dataObj.phase as string | undefined) ||
          (dataObj.summary as string | undefined) ||
          typeStr;
        if (ctx.notifyProgress && typeStr !== 'heartbeat') {
          stepN++;
          // Fire-and-forget; ignore failures (e.g. client doesn't honor notifications).
          ctx.notifyProgress(stepN, undefined, `${typeStr}: ${msg}`).catch(() => undefined);
        }
      });
      return ok(summarizeExec(r), { ...r, events });
    }

    case 'queue_edit': {
      if (!str(a.prompt)) return fail('❌ `prompt` is required for queue_edit.');
      const r = await queueEdit({
        tool: 'autonomous_edit',
        params: { prompt: a.prompt, ...(a.video_url ? { video_url: a.video_url } : {}), ...(Array.isArray(a.assets) ? { assets: a.assets } : {}) },
        projectId: str(a.project_id) || `mcp_${Date.now()}`,
        ...(a.scene !== undefined ? { scene: a.scene } : {}),
      });
      return ok(summarizeAny('queue_edit', r), r);
    }

    case 'check_job_status': {
      const id = str(a.job_id);
      if (!id) return fail('❌ `job_id` is required.');
      const job = a.wait === true ? await waitForJob(id) : await getJobStatus(id);
      return ok(
        `${job.success ? '🔎' : '❌'} job ${job.jobId}: ${job.status} (${job.progress}%) ${job.message}`,
        job
      );
    }

    case 'check_task_status': {
      const id = str(a.task_id);
      if (!id) return fail('❌ `task_id` is required.');
      const r = await getTaskStatus(id);
      return ok(summarizeAny(`task ${id}`, r), r);
    }

    case 'get_active_task': {
      const pid = str(a.project_id);
      if (!pid) return fail('❌ `project_id` is required.');
      const r = await getActiveTask(pid);
      return ok(summarizeAny(`active task for ${pid}`, r), r);
    }

    // Caption templates
    case 'list_caption_templates': {
      const r = await listCaptionTemplates();
      return ok(summarizeAny('caption_templates', r), r);
    }
    case 'apply_caption_template': {
      const tid = str(a.template_id);
      if (!tid) return fail('❌ `template_id` is required.');
      const r = await applyCaptionTemplate({
        templateId: tid,
        projectId: str(a.project_id),
        scene: a.scene,
        mode: str(a.mode),
      });
      return ok(summarizeAny(`apply ${tid}`, r), r);
    }
    case 'save_caption_template': {
      const nm = str(a.name);
      if (!nm) return fail('❌ `name` is required.');
      if (!a.style) return fail('❌ `style` is required.');
      const r = await saveCaptionTemplate({ name: nm, style: a.style, tags: a.tags });
      return ok(summarizeAny('save_caption_template', r), r);
    }
    case 'save_current_caption_template': {
      const nm = str(a.name);
      if (!nm) return fail('❌ `name` is required.');
      const r = await saveCurrentCaptionTemplate({ name: nm, projectId: str(a.project_id), scene: a.scene });
      return ok(summarizeAny('save_current_caption_template', r), r);
    }
    case 'delete_caption_template': {
      const tid = str(a.template_id);
      if (!tid) return fail('❌ `template_id` is required.');
      const r = await deleteCaptionTemplate(tid);
      return ok(summarizeAny(`delete ${tid}`, r), r);
    }

    // Brand kits
    case 'list_brand_kits': {
      const r = await listBrandKits();
      return ok(summarizeAny('brand_kits', r), r);
    }
    case 'get_brand_kit': {
      const id = str(a.brand_id);
      if (!id) return fail('❌ `brand_id` is required.');
      const r = await getBrandKit(id);
      return ok(summarizeAny(`brand ${id}`, r), r);
    }
    case 'create_brand_kit': {
      const nm = str(a.name);
      if (!nm) return fail('❌ `name` is required.');
      const r = await createBrandKit({
        name: nm,
        palette: a.palette,
        fonts: a.fonts,
        gradeBias: str(a.gradeBias),
        forbiddenColors: a.forbiddenColors,
        logoAssetUrl: str(a.logoAssetUrl),
        voiceTone: str(a.voiceTone),
        enforcement: str(a.enforcement),
      });
      return ok(summarizeAny('create_brand_kit', r), r);
    }
    case 'update_brand_kit': {
      const id = str(a.brand_id);
      if (!id) return fail('❌ `brand_id` is required.');
      const body: Record<string, unknown> = {};
      for (const k of ['name', 'palette', 'fonts', 'gradeBias', 'forbiddenColors', 'logoAssetUrl', 'voiceTone', 'enforcement']) {
        if (a[k] !== undefined) body[k] = a[k];
      }
      const r = await updateBrandKit(id, body);
      return ok(summarizeAny(`update brand ${id}`, r), r);
    }
    case 'delete_brand_kit': {
      const id = str(a.brand_id);
      if (!id) return fail('❌ `brand_id` is required.');
      const r = await deleteBrandKit(id);
      return ok(summarizeAny(`delete brand ${id}`, r), r);
    }

    // Projects
    case 'list_projects': {
      const r = await listProjects();
      return ok(summarizeAny('projects', r), r);
    }
    case 'get_project': {
      const id = str(a.project_id);
      if (!id) return fail('❌ `project_id` is required.');
      const r = await getProject(id);
      return ok(summarizeAny(`project ${id}`, r), r);
    }
    case 'create_project': {
      const nm = str(a.name);
      if (!nm) return fail('❌ `name` is required.');
      const r = await createProject({ name: nm, brandId: str(a.brandId), description: str(a.description) });
      return ok(summarizeAny('create_project', r), r);
    }
    case 'delete_project': {
      const id = str(a.project_id);
      if (!id) return fail('❌ `project_id` is required.');
      const r = await deleteProject(id);
      return ok(summarizeAny(`delete project ${id}`, r), r);
    }

    // Assets
    case 'asset_upload_url': {
      const fn = str(a.fileName);
      if (!fn) return fail('❌ `fileName` is required.');
      const r = await assetUploadUrl({
        fileName: fn,
        fileType: str(a.fileType),
        contentType: str(a.contentType),
        projectId: str(a.projectId),
      });
      return ok(summarizeAny('asset_upload_url', r), r);
    }
    case 'list_assets': {
      const query: Record<string, string> = {};
      if (a.projectId) query.projectId = String(a.projectId);
      if (a.fileType) query.fileType = String(a.fileType);
      const r = await listAssets(Object.keys(query).length > 0 ? query : undefined);
      return ok(summarizeAny('assets', r), r);
    }
    case 'delete_asset': {
      const fn = str(a.fileName);
      if (!fn) return fail('❌ `fileName` is required.');
      const r = await deleteAsset(fn);
      return ok(summarizeAny(`delete asset ${fn}`, r), r);
    }
    case 'transcribe_asset': {
      const fn = str(a.fileName);
      if (!fn) return fail('❌ `fileName` is required.');
      const r = await transcribeAsset({ fileName: fn, language: str(a.language) });
      return ok(summarizeAny(`transcribe ${fn}`, r), r);
    }

    case 'editor_health': {
      const h = await health();
      return ok(`${h.ok ? '✅ backend reachable' : '❌ backend unreachable'}\n${h.detail}`, h);
    }

    default:
      return fail(
        `❌ Unknown MCP tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(', ')}.`
      );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Server bootstrap
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  const server = new Server(
    { name: 'levea-mcp-server', version: PKG_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments || {}) as Record<string, unknown>;
    const progressToken = req.params._meta?.progressToken;
    const ctx: DispatchCtx = {
      notifyProgress: progressToken
        ? async (progress, total, message) => {
            try {
              await server.notification({
                method: 'notifications/progress',
                params: { progressToken, progress, total, message },
              });
            } catch (_e) { /* swallow */ }
          }
        : undefined,
    };
    try {
      return await dispatch(name, args, ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(`❌ ${msg}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `levea-mcp-server ${PKG_VERSION} ready (${TOOLS.length} tools)\n`
  );
}

main().catch((err) => {
  process.stderr.write(
    `levea-mcp-server fatal: ${err instanceof Error ? err.stack : String(err)}\n`
  );
  process.exit(1);
});
