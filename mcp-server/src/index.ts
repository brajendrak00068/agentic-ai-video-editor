#!/usr/bin/env node
/**
 * Levea AI Video Editor — MCP server.
 *
 * Exposes the autonomous video editor to any MCP client (Claude Desktop,
 * Claude Code, Cursor, Cline, OpenClaw, Hermes, …) over stdio.
 *
 * Architecture: this server is a thin, stable adapter. All tools map onto the
 * backend contract `POST /api/v1/misc/openclaw/v1/execute`. No editing logic,
 * no shell, no filesystem, no raw renderer access lives here — those stay
 * behind the backend, which allowlists tools server-side.
 *
 * Config (env, set via the MCP client's `mcpServers` entry):
 *   ADSCENE_API_URL   e.g. https://api.livecore.ai   (required)
 *   ADSCENE_API_KEY   from https://studio.livecor.ai/ (required)
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
  getJobStatus,
  waitForJob,
  health,
  type ExecuteResult,
} from './client';

const PKG_VERSION = '0.2.0';

/** Backend tool enum kept in sync with the server-side allowlist. */
const BACKEND_TOOLS = [
  'autonomous_edit',
  'read_scene',
  'read_media',
  'read_visual',
  'query_transcript',
  'scene_update',
  'scene_insert',
  'scene_timing',
  'scene_mask',
  'chroma_key',
  'split_screen',
  'caption_compose',
  'media_treat',
  'scene_track',
  'clean_audio',
  'audio_mix',
  'audio_mixing',
  'voiceover_add',
  'music_generate',
  'export_video',
] as const;

const TOOLS: Tool[] = [
  {
    name: 'autonomous_edit',
    description:
      'PRIMARY TOOL. Run a natural-language video edit end-to-end. The agent plans, executes, verifies, and exports. Accepts anything from a one-liner ("make this TikTok-ready") to a multi-paragraph creative brief. Use this unless you specifically need a deterministic single operation.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Natural-language description of the desired edit or creative brief.',
        },
        project_id: {
          type: 'string',
          description: 'Optional project id for tracking / continuity.',
        },
        video_url: {
          type: 'string',
          description: 'Optional source video URL to edit.',
        },
        scene: {
          type: 'object',
          description:
            'Optional existing scene/timeline state to continue editing.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_viral_clips',
    description:
      'Extract short viral clips from a long video (engaging moments, bold captions, vertical reframe). Convenience wrapper over autonomous_edit.',
    inputSchema: {
      type: 'object',
      properties: {
        video_url: { type: 'string', description: 'Source video URL.' },
        num_clips: { type: 'number', description: 'How many clips (default 5).' },
        min_duration: {
          type: 'number',
          description: 'Min clip length in seconds (default 15).',
        },
        max_duration: {
          type: 'number',
          description: 'Max clip length in seconds (default 60).',
        },
        focus: {
          type: 'string',
          description: 'What to optimize for (e.g. "funny moments", "key insights").',
        },
        project_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'add_captions',
    description:
      'Add styled, word-highlighted captions to the current scene (caption_compose).',
    inputSchema: {
      type: 'object',
      properties: {
        style: {
          type: 'string',
          description: 'Caption style preset (e.g. "viral", "clean"). Default "viral".',
        },
        highlight_words: {
          type: 'array',
          items: { type: 'string' },
          description: 'Words to emphasize.',
        },
        position: {
          type: 'string',
          description: 'center | top | bottom (default center).',
        },
        project_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'remove_silence',
    description: 'Remove silent gaps from the video (clean_audio, silence mode).',
    inputSchema: {
      type: 'object',
      properties: {
        silence_threshold: {
          type: 'number',
          description: 'Amplitude threshold (default 0.02).',
        },
        min_silence_duration: {
          type: 'number',
          description: 'Min silence to cut, in ms (default 500).',
        },
        project_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'read_scene',
    description:
      'Read the current scene / timeline state (layers, durations, metadata). Read-only.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'query_transcript',
    description:
      'Query the video transcript (search words, get timestamps). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text / phrase to find.' },
        project_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'export_video',
    description:
      'Export the final video to MP4. Returns a job id; poll with check_job_status, or set wait=true to block until done.',
    inputSchema: {
      type: 'object',
      properties: {
        quality: {
          type: 'string',
          description: 'standard | high | max (default standard).',
        },
        format: { type: 'string', description: 'Output format (default mp4).' },
        wait: {
          type: 'boolean',
          description: 'If true, block until the export job completes.',
        },
        project_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'check_job_status',
    description:
      'Check the status/progress of an async job (e.g. an export) by job id. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job id to poll.' },
        wait: {
          type: 'boolean',
          description: 'If true, block until the job reaches a terminal state.',
        },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'editor_execute',
    description:
      'Power-user escape hatch: invoke a specific deterministic backend tool with raw params. Prefer autonomous_edit unless you need an exact single operation. Tools are allowlisted server-side.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          enum: BACKEND_TOOLS as unknown as string[],
          description: 'Backend tool name.',
        },
        params: {
          type: 'object',
          description: 'Tool-specific parameters.',
        },
        project_id: { type: 'string' },
      },
      required: ['tool'],
    },
  },
  {
    name: 'editor_health',
    description:
      'Diagnostic: check connectivity to the configured backend (ADSCENE_API_URL). Read-only, unauthenticated.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function summarize(r: ExecuteResult): string {
  const head = r.success ? '✅' : '❌';
  const lines = [`${head} ${r.message || (r.success ? 'Done' : 'Failed')}`];
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

async function dispatch(name: string, a: Record<string, unknown>) {
  switch (name) {
    case 'autonomous_edit': {
      const prompt = str(a.prompt);
      if (!prompt) return fail('❌ `prompt` is required for autonomous_edit.');
      const r = await execute({
        tool: 'autonomous_edit',
        params: { prompt, ...(a.video_url ? { video_url: a.video_url } : {}) },
        project_id: str(a.project_id),
        scene: a.scene,
      });
      return ok(summarize(r), r);
    }
    case 'generate_viral_clips': {
      const n = num(a.num_clips, 5);
      const lo = num(a.min_duration, 15);
      const hi = num(a.max_duration, 60);
      const focus = str(a.focus) || 'the most engaging moments';
      const r = await execute({
        tool: 'autonomous_edit',
        params: {
          prompt: `Generate ${n} viral clips from the video, ${lo}-${hi}s each, focused on ${focus}. Add bold captions, vertical 9:16 reframe, and remove silences.`,
          ...(a.video_url ? { video_url: a.video_url } : {}),
        },
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'add_captions': {
      const r = await execute({
        tool: 'caption_compose',
        params: {
          mode: 'style',
          style: str(a.style) || 'viral',
          highlight_words: Array.isArray(a.highlight_words)
            ? a.highlight_words
            : [],
          position: str(a.position) || 'center',
        },
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'remove_silence': {
      const r = await execute({
        tool: 'clean_audio',
        params: {
          mode: 'silence',
          silence_threshold: num(a.silence_threshold, 0.02),
          min_silence_duration: num(a.min_silence_duration, 500),
        },
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'read_scene':
    case 'read_media':
    case 'read_visual': {
      const r = await execute({
        tool: name,
        params: {},
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'query_transcript': {
      const r = await execute({
        tool: 'query_transcript',
        params: { query: str(a.query) || '' },
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'export_video': {
      const r = await execute({
        tool: 'export_video',
        params: {
          quality: str(a.quality) || 'standard',
          format: str(a.format) || 'mp4',
        },
        project_id: str(a.project_id),
      });
      if (a.wait === true && r.jobId !== undefined) {
        const job = await waitForJob(String(r.jobId));
        return ok(
          `${summarize(r)}\n— job ${job.jobId}: ${job.status} (${job.progress}%) ${job.message}`,
          { execute: r, job }
        );
      }
      return ok(summarize(r), r);
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
    case 'editor_execute': {
      const tool = str(a.tool);
      if (!tool || !(BACKEND_TOOLS as readonly string[]).includes(tool)) {
        return fail(
          `❌ Unknown tool "${tool}". Allowed: ${BACKEND_TOOLS.join(', ')}`
        );
      }
      const r = await execute({
        tool,
        params: (a.params as Record<string, unknown>) || {},
        project_id: str(a.project_id),
      });
      return ok(summarize(r), r);
    }
    case 'editor_health': {
      const h = await health();
      return ok(
        `${h.ok ? '✅ backend reachable' : '❌ backend unreachable'}\n${h.detail}`,
        h
      );
    }
    default:
      return fail(`❌ Unknown MCP tool: ${name}`);
  }
}

async function main() {
  const server = new Server(
    { name: 'levea-mcp-server', version: PKG_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments || {}) as Record<string, unknown>;
    try {
      return await dispatch(name, args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(`❌ ${msg}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP JSON-RPC channel.
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
