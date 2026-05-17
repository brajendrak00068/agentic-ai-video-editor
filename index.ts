import axios from 'axios';
import { definePluginEntry } from 'openclaw/plugin-sdk/core';

/**
 * Levea Agentic Video Editor Handler
 * 
 * Exposes the Levea editor tool surface through OpenClaw.
 */

interface EditorRequest {
  tool: string;
  params: Record<string, any>;
  project_id?: string;
  scene?: any;
}

interface EditorResponse {
  success: boolean;
  message: string;
  data?: any;
  videoUrl?: string;
  jobId?: number;
  status?: string;
}

function openClawExecuteUrl(): string {
  const raw = String(process.env.ADSCENE_API_URL || '').replace(/\/+$/, '');
  if (!raw) throw new Error('ADSCENE_API_URL is required');
  if (raw.endsWith('/api/v1/misc/openclaw/v1/execute')) return raw;
  if (raw.endsWith('/api/v1/misc/openclaw')) return `${raw}/v1/execute`;
  if (raw.endsWith('/api/v1/misc')) return `${raw}/openclaw/v1/execute`;
  return `${raw}/api/v1/misc/openclaw/v1/execute`;
}

/**
 * Main handler for all editor operations
 */
export async function handleEditorOperation(
  request: EditorRequest
): Promise<EditorResponse> {
  const { tool, params, project_id, scene } = request;

  // Validate required parameters
  if (!tool) {
    return {
      success: false,
      message: '❌ Missing required parameter: tool'
    };
  }

  // Server-side tool surface (see misc-service/src/routes/openclaw.routes.ts):
  //   - `autonomous_edit` is the primary tool — takes a free-form params.prompt.
  //   - Everything else here is the deterministic allowlist that fast-paths via
  //     confirmedAction → ConfirmedActionHandler (skips intent decomposition).
  // Anything outside this list is rejected server-side; use autonomous_edit instead.
  const validTools = [
    'autonomous_edit',

    // Read / inspect
    'read_scene', 'read_media', 'read_visual', 'query_transcript',

    // Direct mutations
    'scene_update', 'scene_insert', 'scene_timing',
    'scene_mask', 'chroma_key', 'split_screen',
    'caption_compose', 'media_treat', 'scene_track',

    // Audio
    'clean_audio', 'audio_mix', 'audio_mixing',
    'voiceover_add', 'music_generate',

    // Async / output
    'export_video'
  ];

  if (!validTools.includes(tool)) {
    return {
      success: false,
      message: `❌ Invalid tool: ${tool}. Valid tools: ${validTools.join(', ')}`
    };
  }

  try {
    console.log('[EditorOperation] Processing request:', {
      tool,
      params: JSON.stringify(params).substring(0, 100) + '...',
      project_id
    });

    // Call your existing API
    const response = await axios.post(
      openClawExecuteUrl(),
      {
        tool,
        params,
        projectId: project_id || `openclaw_${Date.now()}`,
        scene
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.ADSCENE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );

    const { success, data, message, videoUrl, jobId, status } = response.data;

    console.log('[EditorOperation] Success:', {
      tool,
      success,
      hasData: !!data,
      videoUrl,
      jobId,
      status
    });

    return {
      success: true,
      message: formatSuccessMessage(tool, message, data),
      data,
      videoUrl,
      jobId,
      status
    };

  } catch (error: any) {
    console.error('[EditorOperation] Error:', {
      tool,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return handleError(tool, error);
  }
}

/**
 * Specialized handlers for common workflows
 */

// Generate viral clips — branchy enough that the brain should plan it; route via autonomous_edit.
export async function generateViralClips(params: {
  video_url?: string;
  num_clips?: number;
  min_duration?: number;
  max_duration?: number;
  prompt?: string;
}): Promise<EditorResponse> {
  const numClips = params.num_clips || 5;
  const minDuration = params.min_duration || 15;
  const maxDuration = params.max_duration || 60;
  const focus = params.prompt || 'most engaging moments';
  return handleEditorOperation({
    tool: 'autonomous_edit',
    params: {
      prompt: `Generate ${numClips} viral clips from the video (${minDuration}-${maxDuration}s each), focused on: ${focus}.`,
      video_url: params.video_url
    }
  });
}

// Add captions with styling
export async function addCaptions(params: {
  style?: string;
  highlight_words?: string[];
  font_size?: number;
  color?: string;
  position?: string;
}): Promise<EditorResponse> {
  return handleEditorOperation({
    tool: 'caption_compose',
    params: {
      mode: 'style',
      style: params.style || 'viral',
      highlight_words: params.highlight_words || [],
      font_size: params.font_size,
      color: params.color,
      position: params.position || 'center'
    }
  });
}

// Remove silence from video
export async function removeSilence(params: {
  silence_threshold?: number;
  min_silence_duration?: number;
}): Promise<EditorResponse> {
  return handleEditorOperation({
    tool: 'clean_audio',
    params: {
      mode: 'silence',
      silence_threshold: params.silence_threshold || 0.02,
      min_silence_duration: params.min_silence_duration || 500
    }
  });
}

// Generate b-roll for specific moments — needs reasoning over placement; route via autonomous_edit.
export async function generateBRoll(params: {
  prompt: string;
  at_time: number;
  placement?: string;
}): Promise<EditorResponse> {
  const placement = params.placement || 'overlay';
  return handleEditorOperation({
    tool: 'autonomous_edit',
    params: {
      prompt: `Generate b-roll footage at ${params.at_time}s as ${placement}: ${params.prompt}.`,
      at_time: params.at_time,
      placement
    }
  });
}

// Apply chroma key (green screen removal)
export async function applyChromaKey(params: {
  layer_id: string;
  chroma_key_color?: string;
  background_src?: string;
}): Promise<EditorResponse> {
  const operations = [];

  // Apply chroma key mask
  operations.push(
    handleEditorOperation({
      tool: 'scene_mask',
      params: {
        masks: [{
          layer_id: params.layer_id,
          mask_mode: 'chroma',
          chroma_key_enabled: true,
          chroma_key_color: params.chroma_key_color || '#00ff00',
          chroma_key_similarity: 0.4,
          chroma_key_smoothness: 0.08
        }]
      }
    })
  );

  // Add background if provided
  if (params.background_src) {
    operations.push(
      handleEditorOperation({
        tool: 'scene_insert',
        params: {
          type: params.background_src.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
          src: params.background_src,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          start_time: 0,
          end_time: 60,
          z_index: 0,
          role: 'background'
        }
      })
    );
  }

  // Execute all operations
  const results = await Promise.all(operations);
  const failed = results.find(r => !r.success);

  if (failed) {
    return failed;
  }

  return {
    success: true,
    message: '✅ Chroma key applied successfully!' + 
             (params.background_src ? '\n📹 Background added' : ''),
    data: results.map(r => r.data)
  };
}

// Track subject in video
export async function trackSubject(params: {
  target?: string;
  smoothness?: number;
  framing_style?: string;
}): Promise<EditorResponse> {
  return handleEditorOperation({
    tool: 'scene_track',
    params: {
      target: params.target || 'auto',
      smoothness: params.smoothness || 0.5,
      framing_style: params.framing_style || 'centered'
    }
  });
}

// Export final video
export async function exportVideo(params: {
  quality?: string;
  resolution?: [number, number];
  format?: string;
}): Promise<EditorResponse> {
  return handleEditorOperation({
    tool: 'export_video',
    params: {
      quality: params.quality || 'standard',
      resolution: params.resolution,
      format: params.format || 'mp4'
    }
  });
}

/**
 * Format success message with emojis and formatting
 */
function formatSuccessMessage(
  tool: string,
  message?: string,
  data?: any
): string {
  const toolMessages: Record<string, string> = {
    read_scene: '📋 Scene loaded',
    read_media: '🎬 Media assets listed',
    read_visual: '👁️ Visual analysis complete',
    scene_update: '✏️ Layer updated',
    scene_insert: '➕ Layer added',
    caption_compose: '💬 Captions generated',
    generate: '🎨 Asset generated',
    clean_audio: '🔇 Silence removed',
    audio_mixing: '🎚️ Audio mixed',
    scene_track: '🎯 Subject tracked',
    export_video: '📹 Video exported',
    scene_mask: '🎭 Mask applied',
    split_screen: '📱 Split screen created',
    media_treat: '🎨 Color grading applied',
    branding_operator: '🏷️ Branding applied',
    scene_vfx: '✨ VFX applied',
    animate_property: '🎬 Animation added',
    batch_update_layers: '📦 Batch update complete'
  };

  let result = toolMessages[tool] || '✅ Operation complete';

  if (message) {
    result += `\n\n${message}`;
  }

  if (data) {
    // Add relevant data snippets
    if (data.layers) {
      result += `\n\n📊 Layers: ${data.layers.length}`;
    }
    if (data.duration) {
      result += `\n⏱️ Duration: ${data.duration}s`;
    }
    if (data.videoUrl) {
      result += `\n📹 Video: ${data.videoUrl}`;
    }
    if (data.jobId) {
      result += `\n🆔 Job ID: ${data.jobId}`;
    }
  }

  return result;
}

/**
 * Handle API errors with user-friendly messages
 */
function handleError(tool: string, error: any): EditorResponse {
  // Tool not found
  if (error.response?.status === 404) {
    return {
      success: false,
      message: `❌ Tool not found: ${tool}. Please check the tool name.`
    };
  }

  // Invalid request
  if (error.response?.status === 400) {
    const errorMsg = error.response.data?.message || 'Invalid request parameters';
    return {
      success: false,
      message: `❌ ${errorMsg}`
    };
  }

  // Unauthorized
  if (error.response?.status === 401 || error.response?.status === 403) {
    return {
      success: false,
      message: '❌ Authentication failed. Please check your API credentials.'
    };
  }

  // Rate limit
  if (error.response?.status === 429) {
    return {
      success: false,
      message: '⏱️ Rate limit exceeded. Please try again in a few minutes.'
    };
  }

  // Timeout
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      success: false,
      message: '⏱️ Processing timeout. The operation may be too complex. Try breaking it into smaller steps.'
    };
  }

  // Network error
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return {
      success: false,
      message: '🌐 Unable to connect to the API. Please check your network connection.'
    };
  }

  // Generic error
  return {
    success: false,
    message: `❌ Unable to execute ${tool} right now. Please try again later.`
  };
}

const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    tool: {
      type: 'string',
      description: 'Tool name. Use `autonomous_edit` with params.prompt for free-form natural-language video edits.',
      enum: [
        'autonomous_edit',
        'read_scene', 'read_media', 'read_visual', 'query_transcript',
        'scene_update', 'scene_insert', 'scene_timing',
        'scene_mask', 'chroma_key', 'split_screen',
        'caption_compose', 'media_treat', 'scene_track',
        'clean_audio', 'audio_mix', 'audio_mixing',
        'voiceover_add', 'music_generate',
        'export_video'
      ]
    },
    params: {
      type: 'object',
      description: 'Tool-specific parameters. For autonomous_edit, set params.prompt to a natural-language description of the desired edit.'
    },
    project_id: {
      type: 'string',
      description: 'Optional project identifier for tracking.'
    }
  },
  required: ['tool']
} as const;

/**
 * OpenClaw plugin registration (2026.5.x contract).
 *
 * The host loader walks the default export for a `register` function. Plain
 * `{ handler, parameters, ... }` objects fail validation on 2026.5+; the
 * `definePluginEntry` + `api.registerTool(...)` shape is the canonical entry.
 */
export default definePluginEntry({
  id: 'openclaw-ai-video-editor',
  name: 'OpenClaw AI Video Editor',
  description: 'Agentic AI video editor — natural-language video edits end-to-end via a single `autonomous_edit` tool: viral clips, captions, vertical reframe, chroma key, AI background removal, audio cleanup, motion tracking, B-roll, voiceover, music, and MP4 / multi-platform export.',
  register(api) {
    api.registerTool({
      name: 'ai-video-editor',
      label: 'AI Video Editor',
      description: 'Run a natural-language video edit. Pass a prompt describing what you want; the agent plans the steps, executes, verifies, and exports. Anything from a one-liner ("make this TikTok-ready") to a multi-paragraph creative brief works.',
      parameters: TOOL_PARAMETERS,
      execute: async (_toolCallId: string, params: any) => {
        const result = await handleEditorOperation(params as EditorRequest);
        return {
          content: [{ type: 'text' as const, text: result.message }],
          details: result,
        };
      },
    });
  },
});
