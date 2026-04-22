const fs = require('fs-extra');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const { LMStudioClient, Chat } = require('@lmstudio/sdk');

const program = new Command();
const client = new LMStudioClient();

const CONFIG_PATH = './paper.config.json';
const MODELS_PATH = './models.json';

/**
 * Core Execution Engine
 * Loads model -> Creates Chat -> Processes -> Unloads
 */
async function runPhase(content, contextData, roleName) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === roleName);

    // 1. Check if model is enabled
    if (!mCfg || !mCfg.enabled) {
        console.log(chalk.yellow(`⚠️  Role [${roleName}] is disabled. Skipping...`));
        return { content, resultText: null };
    }

    // 2. Load Role Definition (Prompt)
    const rolePath = path.join(__dirname, 'roles', `${roleName}.js`);
    if (!fs.existsSync(rolePath)) {
        console.log(chalk.red(`❌ Role file missing: ${rolePath}`));
        return { content, resultText: null };
    }

    // Clear cache to allow real-time prompt editing
    delete require.cache[require.resolve(rolePath)];
    const roleDef = require(rolePath);

    const paper = fs.readJsonSync(CONFIG_PATH);

    try {
        console.log(chalk.blue(`\n[SDK] Loading model: ${mCfg.id}...`));
        const model = await client.llm.load(mCfg.id, {
            ttl: 60, // Auto-unload after 60s idle
            noStream: false
        });

        // 3. Build Chat Context
        const chat = Chat.empty();
        chat.append("system", `${roleDef.system}\nFocus Topic: ${paper.topic}`);

        const userPrompt = contextData
            ? `${roleDef.instruction}\n\nCONTEXT/CRITIQUE:\n${contextData}\n\nCURRENT CONTENT:\n${content}`
            : `${roleDef.instruction}\n\nCURRENT CONTENT:\n${content}`;

        chat.append("user", userPrompt);

        console.log(chalk.cyan(`[SDK] Generating ${roleName} response...`));
        const result = await model.respond(chat);

        // 4. Unload to free VRAM for the next model in the chain
        console.log(chalk.dim(`[SDK] Unloading ${mCfg.id}...`));
        await model.unload();

        return {
            content: (roleName === 'critique') ? content : result.content,
            resultText: result.content
        };
    } catch (err) {
        console.error(chalk.red(`❌ SDK Error in ${roleName}:`), err.message);
        return { content, resultText: null };
    }
}

program.name('research-engine').version('5.0.0');

// COMMAND: Setup
program
    .command('setup <topic>')
    .description('Initialize project with a research topic')
    .action(async (topic) => {
        await fs.ensureDir('./chapters');
        await fs.ensureDir('./drafts');
        await fs.writeJson(CONFIG_PATH, { topic, updated: new Date() }, { spaces: 2 });
        console.log(chalk.green.bold(`\n✅ Project Configured: ${topic}`));
    });

// COMMAND: Evolve
program
    .command('evolve <chapter>')
    .description('Run the full evolution pipeline')
    .option('-e, --count <number>', 'Number of evolution cycles', 1)
    .action(async (chapter, options) => {
        if (!fs.existsSync(CONFIG_PATH)) return console.log(chalk.red("Run setup first!"));

        const filePath = path.join('./chapters', `${chapter}.md`);
        if (!fs.existsSync(filePath)) {
            await fs.writeFile(filePath, `# ${chapter}\nStart your notes here.`);
        }

        let currentContent = await fs.readFile(filePath, 'utf-8');

        for (let i = 1; i <= options.count; i++) {
            console.log(chalk.magenta.bold(`\n================ CYCLE ${i} ================`));

            // PHASE 1: CRITIQUE (Logic Check)
            const phase1 = await runPhase(currentContent, null, 'critique');
            const critiqueText = phase1.resultText;

            // PHASE 2: WRITER (Academic Deepening)
            const phase2 = await runPhase(currentContent, critiqueText, 'writer');
            currentContent = phase2.content;

            // PHASE 3: EDITOR (Grammar/Polishing)
            const phase3 = await runPhase(currentContent, null, 'editor');
            currentContent = phase3.content;

            // PHASE 4: FORMATTER (Public Blog/Formatting)
            const phase4 = await runPhase(currentContent, null, 'formatter');
            currentContent = phase4.content;

            // Save Snapshot
            const savePath = `./drafts/${chapter}_cycle_${i}.md`;
            await fs.writeFile(savePath, currentContent);
            console.log(chalk.green.bold(`\n✔ Cycle ${i} saved to ${savePath}`));
        }

        console.log(chalk.cyan.bold(`\n✨ Evolution complete for ${chapter}.\n`));
    });

program.parse(process.argv);