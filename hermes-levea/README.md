# hermes-levea

Thin **Hermes** wrapper for the Levea AI video editor. There is intentionally
almost nothing here: the real integration is the
[`levea-mcp-server`](../mcp-server/) MCP server. Hermes connects to external
tool servers over MCP, so the "plugin" is just a registration that points
Hermes at that server.

This keeps one tool surface (the MCP server, backed by one backend contract)
instead of a bespoke Hermes codebase that drifts.

## Configure

Set your key once:

```bash
export ADSCENE_API_KEY="your-levea-api-key"   # from https://studio.livecor.ai/
```

## Register with Hermes

Either point Hermes at `hermes.plugin.json` in this folder, or add the MCP
server directly to your Hermes MCP config (see [`mcp.json`](./mcp.json)):

```jsonc
{
  "mcpServers": {
    "levea": {
      "command": "npx",
      "args": ["-y", "levea-mcp-server"],
      "env": {
        "ADSCENE_API_URL": "https://api.livecore.ai",
        "ADSCENE_API_KEY": "${ADSCENE_API_KEY}"
      }
    }
  }
}
```

> The MCP transport/command/env fields are universal. If your Hermes build
> expects a different manifest shape, only the wrapper field names change —
> the MCP server itself does not.

## Tools

Same surface as every other client (`autonomous_edit`, `generate_viral_clips`,
`add_captions`, `export_video`, `check_job_status`, …). See the
[MCP server README](../mcp-server/README.md).
