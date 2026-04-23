const fs = require('fs-extra');
const { LMStudioClient } = require('@lmstudio/sdk');
const chalk = require('chalk');

async function checkVRAMWorkflow() {
    const client = new LMStudioClient();
    let modelsConfig;

    try {
        modelsConfig = await fs.readJson('./models.json');
    } catch (err) {
        console.error(chalk.red("❌ Could not read models.json. Ensure the file exists."));
        return;
    }

    const enabledModels = modelsConfig.available_models.filter(m => m.enabled);

    console.log(chalk.cyan.bold(`\n🔍 Testing ${enabledModels.length} Enabled Models for Load/Unload Performance...\n`));

    for (const mCfg of enabledModels) {
        console.log(chalk.white(`Testing: ${chalk.bold(mCfg.name)} (${mCfg.id})`));

        try {
            // 1. ATTEMPT LOAD
            const startLoad = Date.now();
            console.log(chalk.dim(`   ⏳ Loading into VRAM...`));
            const model = await client.llm.load(mCfg.id, { ttl: 30 });
            const loadTime = ((Date.now() - startLoad) / 1000).toFixed(2);
            console.log(chalk.green(`   ✅ Loaded successfully in ${loadTime}s`));

            // 2. HANDSHAKE (Verify it's actually responding)
            console.log(chalk.dim(`   ⚡ Sending handshake request...`));
            await model.respond("Hi");
            console.log(chalk.green(`   ✅ Handshake successful.`));

            // 3. ATTEMPT UNLOAD
            console.log(chalk.dim(`   ♻️  Unloading from memory...`));
            await model.unload();
            console.log(chalk.green(`   ✅ Unloaded successfully.`));
            console.log(chalk.dim(`-------------------------------------------`));

        } catch (error) {
            console.error(chalk.red(`   ❌ FAILED: ${error.message}`));
            console.log(chalk.yellow(`   Check if the model is downloaded or if your GPU is out of memory.`));
            console.log(chalk.dim(`-------------------------------------------`));
        }
    }

    console.log(chalk.cyan.bold(`\n✨ VRAM Test Complete. If all checks passed, your research engine is ready.\n`));
}

checkVRAMWorkflow();