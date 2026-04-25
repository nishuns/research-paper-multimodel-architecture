const { Command } = require('commander');
const chalk = require('chalk');
const fileUtils = require('./src/utils/file-utils');
const { runPhase, analyzeTopic, suggestTopics } = require('./src/core/engine');

const program = new Command();

program.name('research-engine').version('6.0.0');

// COMMAND: Suggest (Provides topic ideas)
program
    .command('suggest [field]')
    .description('Suggest compelling research topics')
    .action(async (field) => {
        await suggestTopics(field);
    });

// COMMAND: Setup (Initializes the project, log, and analysis)
program
    .command('setup <topic>')
    .description('Initialize project with a topic and architectural analysis')
    .action(async (topic) => {
        await fileUtils.ensureProjectDirs();
        await fileUtils.writeConfig(topic);
        await fileUtils.createIntroIfMissing(topic);
        
        console.log(chalk.green.bold(`\n✅ Project Configured for: ${topic}`));
        
        // New: Architectural Analysis
        await analyzeTopic(topic);
    });

// COMMAND: Evolve (The main pipeline)
program
    .command('evolve <chapter>')
    .description('Run the full evolution pipeline')
    .option('-e, --count <number>', 'Number of evolution cycles', 1)
    .action(async (chapter, options) => {
        if (!fileUtils.configExists()) {
            return console.log(chalk.red("Run setup first!"));
        }

        let currentContent = await fileUtils.readChapter(chapter);

        for (let i = 1; i <= options.count; i++) {
            console.log(chalk.magenta.bold(`\n================ CYCLE ${i} ================`));

            // PHASE 1: CRITIQUE
            const p1 = await runPhase(currentContent, null, 'critique', i);

            // PHASE 2: WRITER
            const p2 = await runPhase(currentContent, p1.resultText, 'writer', i);
            currentContent = p2.content;

            // PHASE 3: EDITOR
            const p3 = await runPhase(currentContent, null, 'editor', i);
            currentContent = p3.content;

            // PHASE 4: FORMATTER
            const p4 = await runPhase(currentContent, null, 'formatter', i);
            currentContent = p4.content;

            // Save Snapshot
            const savePath = await fileUtils.saveDraft(chapter, i, currentContent);
            console.log(chalk.green.bold(`\n✔ Cycle ${i} saved to ${savePath}`));
        }

        console.log(chalk.cyan.bold(`\n✨ Evolution complete for ${chapter}.\n`));
    });

program.parse(process.argv);
