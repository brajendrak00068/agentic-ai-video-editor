# Levea — Multi-Platform MCP Launch Kit

Use this document to feed launch copy and structured payloads directly into your social-media/publishing MCP servers (such as `kadenzo-mcp`, `content-distribution-mcp`, `Pipepost`, or direct post tools) to launch **Levea AI Video Editor** across the web.

---

## 1. Reddit MCP Payload (`r/mcp`, `r/ClaudeAI`, `r/sideproject`, `r/LocalLlama`)
*Perfect for direct submission via `AutomateLab-tech/content-distribution-mcp` or any Reddit poster tool.*

### Target Subreddits
- **`r/mcp`** (Focus: Open-source protocols, custom servers)
- **`r/ClaudeAI`** (Focus: Agent workflows, Claude Desktop integrations)
- **`r/sideproject`** (Focus: Indie building, SaaS launch)
- **`r/LocalLlama`** (Focus: Developer utilities, agentic tools)

### Subreddit-Specific Copy & Tool Payload

```json
{
  "platform": "reddit",
  "subreddits": ["mcp", "ClaudeAI", "sideproject"],
  "post_type": "link_text",
  "title": "Show Reddit: Levea — Prompt-First AI Video Editor over MCP (Auto Captions, B-Roll, Motion Graphics)",
  "url": "https://smithery.ai/servers/brajendrak00068/levea-ai-video-editor",
  "body": "Hi r/mcp and fellow builders,\n\nWe just launched **Levea AI Video Editor** as a fully standardized MCP server!\n\n### What is Levea?\nInstead of spending hours manually trimming, aligning captions, and keyframing motion graphics on a traditional timeline, Levea lets you describe your creative goal in plain language: \n\n*\"Generate a viral vertical clip, add word-by-word bold captions, remove silences, track my face, add B-roll and motion graphics, and export for TikTok and Reels.\"*\n\nBehind the scenes, Levea parses your prompt into typed intents, compiles them into a Directed Acyclic Graph (DAG), executes them through safety gates, and exports a high-performance MP4.\n\n### Core Capabilities Included:\n- **Vertical Reframing & Silence Cuts**\n- **Auto Captions** (40+ styles with word-by-word active animation)\n- **Motion Graphics** (Rich, procedural Rive overlays like social cards, lower thirds, and callouts)\n- **AI B-Roll, Voiceovers & Music** (Google Cloud TTS + AI reference matching)\n- **Multi-Platform Export** (TikTok, YouTube Shorts, Reels, 9:16 vertical bundles)\n\n### How to Run it:\nYou can connect Levea to your favorite MCP client (Claude Desktop, Claude Code, Cursor, Cline, or OpenClaw) instantly:\n\n```json\n{\n  \"mcpServers\": {\n    \"levea\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"levea-mcp-server\"],\n      \"env\": {\n        \"LEVEA_API_URL\": \"https://api.livecore.ai\",\n        \"LEVEA_API_KEY\": \"your-levea-api-key\"\n      }\n    }\n  }\n}\n```\n\n*(Generate your API key for free at https://studio.livecore.ai/)*\n\nWould love to hear your feedback, especially around how our Workflow DAG handle-flow matches your agent workflows!"
}
```

---

## 2. Hacker News (HN) Payload (`Show HN`)
*Optimized for a highly technical developer audience who appreciate clean, deterministic compile pipelines.*

```json
{
  "platform": "hackernews",
  "title": "Show HN: Levea — Prompt-to-Video editor powered by deterministic Workflow DAGs",
  "url": "https://github.com/brajendrak00068/openclaw-ai-video-editor",
  "text": "Hi HN,\n\nWe built Levea because we were frustrated with how standard AI video tools work. Most of them use loose LLM loops that hallucinate edits, drop layers, or mess up frame alignments. \n\nLevea takes a different approach: **Prompt → LLM emits typed Intermediate Representation (IR) → Deterministic compiler expands to a Workflow DAG → Gated executor mutates Vulkan-accelerated scene → Automated verification and repairs.**\n\nWe’ve just open-sourced our client-side Model Context Protocol (MCP) server wrapper (`levea-mcp-server`) and launched our core server bundle on Smithery (https://smithery.ai/servers/brajendrak00068/levea-ai-video-editor).\n\n### Technical Highlights:\n1. **Deterministic Orchestration:** We use LLMs solely for metadata parsing and parameters resolution. The actual timeline edits (trimming, alignment, caption generation, speed ramps, and Rive-based motion graphics materialization) are executed strictly via our deterministic compiler.\n2. **Rich Aesthetics & Performance:** Built with native C++/Vulkan acceleration on the rendering side, supporting full cinematic SDF text layouts, high-end motion graphics overlays, and smart frame-by-frame parallel rendering.\n3. **MCP Stdio Protocol:** Runs entirely locally via `npx -y levea-mcp-server` over stdio and links directly to Cursor, Cline, or Claude Code.\n\nWe'd love to hear your thoughts on the compilation pipeline and how we balance LLM interpretation with deterministic rendering!"
}
```

---

## 3. X (Twitter) Hook Payload
*Highly engaging, short-form copy with visual callouts and hashtags for viral reach. Compatible with `kadenzo-mcp` or `postfast-mcp`.*

```json
{
  "platform": "twitter",
  "text": "🎥 Say goodbye to video timelines.\n\nIntroducing Levea: The first prompt-first autonomous AI Video Editor powered by MCP.\n\n💬 Say it in plain language.\n🤖 It plans, edits, and verifies the video.\n⚡ High-end captions, motion graphics, and B-roll.\n\nRun it in Claude Code or Cursor: \n`npx -y levea-mcp-server` \n\nLive on Smithery: https://smithery.ai/servers/brajendrak00068/levea-ai-video-editor\n\n#AI #VideoEditing #MCP #IndieDev #SaaS"
}
```

---

## 4. LinkedIn Professional Post Payload
*Focuses on productivity, SaaS growth hacks, and agency optimization.*

```json
{
  "platform": "linkedin",
  "title": "Reinventing Video Production: Say Goodbye to Timelines",
  "text": "Video content is king, but the timeline editor is a bottleneck. \n\nWhether you are a creator, agency owner, or marketer, spending hours splitting clips, keyframing lower-thirds, and syncing captions is holding you back. \n\nThat is why we built **Levea** — an Agentic AI Video Editor that completely removes the manual timeline. \n\nYou provide the creative direction in plain text, and Levea's deterministic agentic compiler builds a Workflow DAG, executes frame-accurate cuts, renders cinematic SDF word-by-word captions, and applies gorgeous motion graphics overlays. \n\n🚀 We are officially live on Smithery today!\n\n💻 Try it directly inside your developer environment (Cursor, Claude Code, Cline) with one line:\n`npx -y levea-mcp-server`\n\n🔗 Get your free API key at https://studio.livecore.ai/\n\n#GenerativeAI #VideoProduction #SaaS #Productivity #ModelContextProtocol"
}
```

---

## 5. Product Hunt Launch Payload
*Fully detailed product features and specifications for a curated audience.*

```json
{
  "platform": "producthunt",
  "product_name": "Levea AI Video Editor",
  "tagline": "The prompt-first autonomous video editor with captions and motion graphics",
  "description": "Levea is an agentic AI video editor that turns a natural language prompt into a finished, professional vertical video.\n\nNo manual timelines. You describe what you want, and our deterministic Workflow DAG engine schedules trimming, vertical reframing, high-end SDF captions, Rive-based motion graphics (Reddit/Tweet cards, title slides, lower thirds), AI voiceovers, B-roll, and background music, then performs an automated quality check before export.\n\nWe are integrated directly into the Model Context Protocol (MCP) ecosystem so you can edit videos directly from Claude, Cline, or Cursor as part of your development and marketing flows.",
  "topics": ["Artificial Intelligence", "Video", "Developer Tools", "SaaS"]
}
```
