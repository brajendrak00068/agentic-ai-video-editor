import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Thin HTTP client for the Levea editor backend.
 *
 * This client is a *pass-through*: it does not implement any editing logic.
 * The single source of truth is the backend contract at
 * `POST /api/v1/misc/openclaw/v1/execute` (+ `GET /api/v1/misc/openclaw/v1/jobs/:jobId`).
 * Every MCP tool maps onto that contract so the tool surface never forks.
 */

export interface ExecuteResult {
  success: boolean;
  message?: string;
  data?: unknown;
  videoUrl?: string;
  jobId?: number | string;
  status?: string;
  raw?: unknown;
}

export interface JobStatus {
  success: boolean;
  jobId: string;
  status: string;
  progress: number;
  message: string;
  result?: unknown;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_TIMEOUT_MS = 300_000;

function baseRoot(): string {
  const raw = String(process.env.ADSCENE_API_URL || '').replace(/\/+$/, '');
  if (!raw) {
    throw new Error(
      'ADSCENE_API_URL is required (e.g. https://api.livecore.ai). ' +
        'Set it in the MCP client env / mcpServers config.'
    );
  }
  // Normalize to the API root regardless of how much path the user supplied.
  if (raw.endsWith('/api/v1/misc/openclaw/v1/execute')) {
    return raw.slice(0, -'/v1/execute'.length); // -> .../openclaw
  }
  if (raw.endsWith('/api/v1/misc/openclaw')) return raw;
  if (raw.endsWith('/api/v1/misc')) return `${raw}/openclaw`;
  return `${raw}/api/v1/misc/openclaw`;
}

function executeUrl(): string {
  return `${baseRoot()}/v1/execute`;
}

function jobUrl(jobId: string): string {
  return `${baseRoot()}/v1/jobs/${encodeURIComponent(jobId)}`;
}

function healthUrl(): string {
  return `${baseRoot()}/v1/health`;
}

function apiKey(): string {
  const key = process.env.ADSCENE_API_KEY;
  if (!key) {
    throw new Error(
      'ADSCENE_API_KEY is required. Generate one at https://studio.livecor.ai/ ' +
        'and set it in the MCP client env / mcpServers config.'
    );
  }
  return key;
}

function http(): AxiosInstance {
  return axios.create({
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    timeout: DEFAULT_TIMEOUT_MS,
    // Resolve all <500 so we can surface structured backend errors as tool
    // results instead of throwing opaque axios errors at the MCP layer.
    validateStatus: (s) => s < 500,
  });
}

function describeError(err: unknown, label: string): never {
  const e = err as AxiosError<{ message?: string; error?: string }>;
  const upstream =
    e.response?.data?.error || e.response?.data?.message || e.message;
  const code = e.response?.status;
  if (code === 401 || code === 403) {
    throw new Error(
      `${label} failed: authentication rejected (HTTP ${code}). ` +
        `Check ADSCENE_API_KEY — generate a fresh key at https://studio.livecor.ai/.`
    );
  }
  throw new Error(
    `${label} failed${code ? ` (HTTP ${code})` : ''}: ${upstream}`
  );
}

/**
 * Execute any backend tool. The backend allowlists tools server-side, so this
 * is a safe pass-through — invalid tools are rejected upstream, not here.
 */
export async function execute(args: {
  tool: string;
  params?: Record<string, unknown>;
  project_id?: string;
  scene?: unknown;
}): Promise<ExecuteResult> {
  const { tool, params, project_id, scene } = args;
  const body = {
    tool,
    params: params || {},
    projectId: project_id || `mcp_${Date.now()}`,
    ...(scene !== undefined ? { scene } : {}),
  };
  try {
    const res = await http().post(executeUrl(), body);
    const d = (res.data || {}) as Record<string, unknown>;
    if (res.status >= 400) {
      const msg =
        (d.error as string) || (d.message as string) || `HTTP ${res.status}`;
      return { success: false, message: msg, status: 'error', raw: d };
    }
    return {
      success: d.success !== false,
      message: d.message as string | undefined,
      data: d.data,
      videoUrl: d.videoUrl as string | undefined,
      jobId: d.jobId as string | number | undefined,
      status: d.status as string | undefined,
      raw: d,
    };
  } catch (err) {
    return describeError(err, `execute(${tool})`);
  }
}

/** Poll a single async job (export / long-running task) by id. */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  try {
    const res = await http().get(jobUrl(jobId));
    const d = (res.data || {}) as Record<string, unknown>;
    if (res.status === 404) {
      return {
        success: false,
        jobId,
        status: 'not_found',
        progress: 0,
        message: 'Job not found',
      };
    }
    return {
      success: d.success !== false,
      jobId: (d.jobId as string) || jobId,
      status: (d.status as string) || 'unknown',
      progress: (d.progress as number) || 0,
      message: (d.message as string) || '',
      result: d.result,
      error: (d.error as string | null) ?? null,
      createdAt: d.createdAt as string | undefined,
      updatedAt: d.updatedAt as string | undefined,
    };
  } catch (err) {
    return describeError(err, `getJobStatus(${jobId})`);
  }
}

/**
 * Block until a job reaches a terminal state or the deadline passes.
 * Used by tools that opt into synchronous completion.
 */
export async function waitForJob(
  jobId: string,
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<JobStatus> {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const pollMs = opts.pollMs ?? 4_000;
  const deadline = Date.now() + timeoutMs;
  const terminal = new Set([
    'completed',
    'complete',
    'succeeded',
    'success',
    'failed',
    'error',
    'cancelled',
    'canceled',
    'not_found',
  ]);
  let last = await getJobStatus(jobId);
  while (!terminal.has(last.status.toLowerCase())) {
    if (Date.now() > deadline) {
      return { ...last, message: `${last.message} (poll timed out)` };
    }
    await new Promise((r) => setTimeout(r, pollMs));
    last = await getJobStatus(jobId);
  }
  return last;
}

/** Unauthenticated health probe — useful for connection diagnostics. */
export async function health(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await axios.get(healthUrl(), { timeout: 15_000 });
    const status = (res.data as { status?: string })?.status;
    return { ok: status === 'healthy', detail: JSON.stringify(res.data) };
  } catch (err) {
    const e = err as AxiosError;
    return { ok: false, detail: e.message };
  }
}
