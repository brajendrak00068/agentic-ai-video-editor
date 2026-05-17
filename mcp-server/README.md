# Levea MCP Server

> Autonomous AI video editing for any MCP client — Claude Desktop, Claude Code, Cursor, Cline, OpenClaw, Hermes.

`levea-mcp-server` exposes the Levea autonomous video editor over the
[Model Context Protocol](https://modelcontextprotocol.io). One prompt →
the agent plans, edits, verifies, and exports: viral clips, captions,
vertical 9:16 reframe, chroma key, audio cleanup, motion tracking, B‑roll,
voiceover, music, and MP4 export.

It is a **thin, stable adapter**. Every tool maps onto one backend contract
(`POST /api/v1/misc/openclaw/v1/execute`). No editing logic, shell, filesystem,
or raw renderer access lives in this process — those stay behind the backend,
which allowlists tools server‑side.

## Tools

| Tool | What it does |
|---|---|
| `autonomous_edit` | **Primary.** Natural‑language edit / creative brief, end‑to‑end. |
| `generate_viral_clips` | Short viral clips from a long video. |
| `add_captions` | Styled, word‑highlighted captions. |
| `remove_silence` | Cut silent gaps. |
| `read_scene` / `query_transcript` | Read‑only inspection. |
| `export_video` | Export MP4 (optionally block until done). |
| `check_job_status` | Poll an async job (optionally wait for terminal state). |
| `editor_execute` | Power‑user escape hatch (allowlisted backend tool + raw params). |
| `editor_health` | Connectivity diagnostic (unauthenticated). |

## Configuration

Two environment variables:

| Var | Required | Value |
|---|---|---|
| `ADSCENE_API_URL` | yes | `https://api.livecore.ai` |
| `ADSCENE_API_KEY` | yes | Generate at <https://studio.livecor.ai/> |

> Use `https://api.livecore.ai` — **not** `https://studio.livecor.ai`. Studio is
> the user‑facing app; MCP traffic goes to the API‑key route.

## Install

### Claude Desktop / Claude Code / Cursor / Cline

```jsonc
{
  "mcpServers": {
    "levea": {
      "command": "npx",
      "args": ["-y", "levea-mcp-server"],
      "env": {
        "ADSCENE_API_URL": "https://api.livecore.ai",
        "ADSCENE_API_KEY": "your-levea-api-key"
      }
    }
  }
}
```

(Claude Code: `claude mcp add levea -e ADSCENE_API_URL=https://api.livecore.ai -e ADSCENE_API_KEY=… -- npx -y levea-mcp-server`)

### OpenClaw

```bash
openclaw mcp add levea --command "npx -y levea-mcp-server" \
  --env ADSCENE_API_URL=https://api.livecore.ai \
  --env ADSCENE_API_KEY=your-levea-api-key
```

### Hermes

See [`../hermes-levea/`](../hermes-levea/) — a thin Hermes wrapper that registers this MCP server.

## Develop

```bash
npm install
npm run build
ADSCENE_API_URL=https://api.livecore.ai ADSCENE_API_KEY=… npm start
```

## Publish

```bash
# 1. npm (requires `npm login`)
npm publish --access public

# 2. Official MCP Registry (requires the mcp-publisher CLI)
mcp-publisher login github
mcp-publisher publish        # validates server.json against the published npm package
```

`package.json` carries `mcpName: io.github.brajendrak00068/levea-mcp-server`,
which the registry cross‑checks against `server.json`.

## License

MIT
