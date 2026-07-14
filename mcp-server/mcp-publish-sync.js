const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(msg) {
  console.log(`\x1b[36m[Sync & Publish]\x1b[0m ${msg}`);
}

function runCmd(cmd, dir = __dirname) {
  log(`Running: "${cmd}"...`);
  try {
    const out = execSync(cmd, { cwd: dir, encoding: 'utf-8', stdio: 'inherit' });
    return { success: true, out };
  } catch (err) {
    console.error(`\x1b[31m❌ Command failed:\x1b[0m ${cmd}\nError: ${err.message}`);
    return { success: false, error: err };
  }
}

async function main() {
  log('Starting unified update and publication cycle...');

  // 1. Recompile the TypeScript source files
  const buildResult = runCmd('npm run build');
  if (!buildResult.success) {
    process.exit(1);
  }

  // 2. Programmatically load compiled tools & extract metadata
  log('Extracting compiled tool schemas from dist/index.js...');
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ manifest.json not found!');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  try {
    const { TOOLS } = require('./dist/index.js');
    if (!TOOLS || !Array.isArray(TOOLS)) {
      throw new Error('TOOLS array is missing or invalid in compiled dist/index.js');
    }

    log(`Found ${TOOLS.length} tools. Syncing schemas into manifest._meta...`);

    // Format tools to fit the object dictionary schema expected by MCPB spec
    const toolsObj = {};
    for (const tool of TOOLS) {
      toolsObj[tool.name] = {
        description: tool.description,
        inputSchema: tool.inputSchema
      };
    }

    manifest._meta = {
      tools: toolsObj
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    log('Successfully updated manifest.json statically with all tool capabilities!');
  } catch (err) {
    console.error(`❌ Failed to sync tool schemas: ${err.message}`);
    process.exit(1);
  }

  // 3. Compile the local folder into a portable .mcpb bundle
  log('Packaging bundle into server.mcpb...');
  const packResult = runCmd('npx -y @anthropic-ai/mcpb pack . server.mcpb');
  if (!packResult.success) {
    process.exit(1);
  }

  // 4. Automatically publish to Smithery
  log('Publishing latest release bundle to Smithery Registry...');
  // We automatically echo "y" to bypass interactive creation prompts if the server is updated or re-released
  const publishResult = runCmd('echo "y" | smithery mcp publish ./server.mcpb -n brajendrak00068/levea-ai-video-editor');
  if (!publishResult.success) {
    process.exit(1);
  }

  log('✨ Unified update, sync, and publish cycle completed successfully! Your Smithery page is now fully updated.');
}

main().catch(err => {
  console.error(`Fatal sync error: ${err.stack || err}`);
  process.exit(1);
});
