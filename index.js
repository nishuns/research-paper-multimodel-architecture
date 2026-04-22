const fs = require('fs-extra');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const { LMStudioClient, Chat } = require('@lmstudio/sdk');

const program = new Command();
const client = new LMStudioClient();

const CONFIG_PATH = './paper.config.json';
const MODELS_PATH = './models.json';
const LOG_PATH = './prompt_log.md';

/**
 * Core Execution Engine with Prompt Logging and SDK Chat Object
 */
async function runPhase(content, contextData, roleName) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === roleName);

    // 1. Skip if the model is disabled in models.json
    if (!mCfg || !mCfg.enabled) {
        console.log(chalk.yellow(`⚠️  Role [${roleName}] is disabled. Skipping...`));
        return { content, resultText: null };
    }

    // 2. Load Role Definition (System Prompt & Instruction)
    const rolePath = path.join(__dirname, 'roles', `${roleName}.js`);
    if (!fs.existsSync(rolePath)) {
        console.log(chalk.red(`❌ Role file missing: ${rolePath}`));
        return { content, resultText: null };
    }

    // Clear cache to allow for real-time prompt editing in role files
    delete require.cache[require.resolve(rolePath)];
    const roleDef = require(rolePath);
    const paper = fs.readJsonSync(CONFIG_PATH);

    try {
        console.log(chalk.blue(`\n[SDK] Loading model: ${mCfg.id}...`));
        const model = await client.llm.load(mCfg.id, { ttl: 60 });

        const chat = Chat.empty();
        const systemMessage = `${roleDef.system}\nProject Topic: ${paper.topic}`;
        chat.append("system", systemMessage);

        const userPrompt = contextData
            ? `${roleDef.instruction}\n\nCONTEXT/CRITIQUE:\n${contextData}\n\nCURRENT CONTENT:\n${content}`
            : `${roleDef.instruction}\n\nCURRENT CONTENT:\n${content}`;

        chat.append("user", userPrompt);

        // --- LOGGING ---
        const logHeader = `\n## ROLE: ${roleName.toUpperCase()} | MODEL: ${mCfg.id}\n` +
            `**Timestamp:** ${new Date().toLocaleString()}\n` +
            `**System Prompt:** \n> ${systemMessage}\n\n` +
            `**User Prompt:**\n\`\`\`text\n${userPrompt}\n\`\`\`\n`;
        await fs.appendFile(LOG_PATH, logHeader);

        console.log(chalk.cyan(`[SDK] Generating ${roleName} response...`));
        const result = await model.respond(chat);

        await fs.appendFile(LOG_PATH, `**Response:**\n${result.content}\n\n---\n`);

        // 3. Unload to free VRAM for the next model in the pipeline
        console.log(chalk.dim(`[SDK] Unloading ${mCfg.id}...`));
        await model.unload();

        return {
            content: (roleName === 'critique') ? content : result.content,
            resultText: result.content
        };
    } catch (err) {
        const errorMsg = `\n❌ SDK Error in ${roleName}: ${err.message}\n`;
        console.error(chalk.red(errorMsg));
        await fs.appendFile(LOG_PATH, errorMsg);
        return { content, resultText: null };
    }
}

program.name('research-engine').version('5.2.0');

// COMMAND: Setup (Initializes the project and log)
program
    .command('setup <topic>')
    .description('Initialize project with a topic')
    .action(async (topic) => {
        await fs.ensureDir('./chapters');
        await fs.ensureDir('./drafts');
        await fs.writeJson(CONFIG_PATH, { topic, updated: new Date() }, { spaces: 2 });

        await fs.writeFile(LOG_PATH, `# PROMPT LOG: ${topic}\nStarted: ${new Date().toLocaleString()}\n\n---\n`);

        const introPath = './chapters/intro.md';
        if (!fs.existsSync(introPath)) {
            const starter = `# Introduction\n\nTopic: ${topic}\n\n[AI: Please generate the initial research introduction based on the topic above.]`;
            await fs.writeFile(introPath, starter);
        }

        console.log(chalk.green.bold(`\n✅ Project Configured for: ${topic}`));
    });

// COMMAND: Evolve (The main pipeline)
program
    .command('evolve <chapter>')
    .description('Run the full evolution pipeline')
    .option('-e, --count <number>', 'Number of evolution cycles', 1)
    .action(async (chapter, options) => {
        if (!fs.existsSync(CONFIG_PATH)) return console.log(chalk.red("Run setup first!"));

        const filePath = path.join('./chapters', `${chapter}.md`);
        if (!fs.existsSync(filePath)) {
            await fs.writeFile(filePath, `# ${chapter}\nDraft notes here.`);
        }

        let currentContent = await fs.readFile(filePath, 'utf-8');

        for (let i = 1; i <= options.count; i++) {
            console.log(chalk.magenta.bold(`\n================ CYCLE ${i} ================`));

            // PHASE 1: CRITIQUE (DeepSeek)
            const p1 = await runPhase(currentContent, null, 'critique');

            // PHASE 2: WRITER (Qwen 3.5)
            const p2 = await runPhase(currentContent, p1.resultText, 'writer');
            currentContent = p2.content;

            // PHASE 3: EDITOR (Gemma)
            const p3 = await runPhase(currentContent, null, 'editor');
            currentContent = p3.content;

            // PHASE 4: FORMATTER (Coder 7B)
            const p4 = await runPhase(currentContent, null, 'formatter');
            currentContent = p4.content;

            // Save Snapshot
            const savePath = `./drafts/${chapter}_cycle_${i}.md`;
            await fs.ensureDir('./drafts');
            await fs.writeFile(savePath, currentContent);
            console.log(chalk.green.bold(`\n✔ Cycle ${i} saved to ${savePath}`));
        }

        console.log(chalk.cyan.bold(`\n✨ Evolution complete for ${chapter}.\n`));
    });

program.parse(process.argv);