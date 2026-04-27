const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const fileUtils = require('./src/utils/file-utils');
const { runPhase, analyzeTopic, suggestTopics } = require('./src/core/engine');

const program = new Command();

program.name('research-engine').version('6.0.0');

// COMMAND: Suggest (Provides topic ideas)
program
    .command('suggest [field]')
    .description('Suggest compelling research topics')
    .action(async (field) => {
        let selectedField = field;
        const suggestionsPath = './suggestions.json';
        const hasExisting = fs.existsSync(suggestionsPath);

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'mode',
                message: 'Manage Suggestions:',
                choices: [
                    { name: 'Append to existing suggestions', value: 'append' },
                    { name: 'Clear all and start new list', value: 'new' }
                ],
                when: () => hasExisting
            },
            {
                type: 'input',
                name: 'field',
                message: 'Describe the research field or topic for suggestions:',
                default: selectedField || 'General Trends',
                when: (answers) => !selectedField || answers.mode
            }
        ]);

        const mode = answers.mode || 'new';
        selectedField = answers.field || selectedField || 'General Trends';

        if (mode === 'new' && hasExisting) {
            await fs.remove(suggestionsPath);
            console.log(chalk.yellow('🗑  Existing suggestions cleared.'));
        }

        await suggestTopics(selectedField);
    });

// COMMAND: Setup (Initializes the project, log, and analysis)
program
    .command('setup [topic]')
    .description('Initialize project with a topic and architectural analysis')
    .action(async (topic) => {
        let selectedTopic = topic;

        if (!selectedTopic) {
            const suggestionsPath = './suggestions.json';
            let choices = [];
            if (fs.existsSync(suggestionsPath)) {
                choices = fs.readJsonSync(suggestionsPath);
            }
            choices.push(new inquirer.Separator());
            choices.push('Other (Enter manually)');

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'topicChoice',
                    message: 'Select a research topic from suggestions:',
                    choices: choices
                },
                {
                    type: 'input',
                    name: 'manualTopic',
                    message: 'Enter your custom research topic:',
                    when: (answers) => answers.topicChoice === 'Other (Enter manually)',
                    validate: (input) => input.trim().length > 0 || 'Topic cannot be empty'
                }
            ]);

            selectedTopic = answers.topicChoice === 'Other (Enter manually)' ? answers.manualTopic : answers.topicChoice;
        }

        await fileUtils.ensureProjectDirs();
        await fileUtils.writeConfig(selectedTopic);
        await fileUtils.createIntroIfMissing(selectedTopic);
        
        console.log(chalk.green.bold(`\n✅ Project Configured for: ${selectedTopic}`));
        
        // New: Architectural Analysis
        await analyzeTopic(selectedTopic);
    });

// COMMAND: Evolve (The main pipeline)
program
    .command('evolve [chapter]')
    .description('Run the full evolution pipeline')
    .option('-e, --count <number>', 'Number of evolution cycles')
    .action(async (chapter, options) => {
        if (!fileUtils.configExists()) {
            return console.log(chalk.red("Run setup first!"));
        }

        let selectedChapter = chapter;
        let count = options.count;

        if (!selectedChapter) {
            const chaptersDir = './chapters';
            if (!fs.existsSync(chaptersDir)) {
                return console.log(chalk.red("No chapters found. Run setup first!"));
            }
            const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.md'));
            if (files.length === 0) {
                return console.log(chalk.red("No chapter files found in ./chapters/"));
            }

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'chapter',
                    message: 'Select a chapter to evolve:',
                    choices: files.map(f => f.replace('.md', ''))
                }
            ]);
            selectedChapter = answers.chapter;
        }

        if (!count) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'count',
                    message: 'How many evolution cycles?',
                    default: 1,
                    validate: (input) => !isNaN(parseInt(input)) || 'Please enter a number'
                }
            ]);
            count = parseInt(answers.count);
        }

        let currentContent = await fileUtils.readChapter(selectedChapter);

        for (let i = 1; i <= count; i++) {
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
            const savePath = await fileUtils.saveDraft(selectedChapter, i, currentContent);
            console.log(chalk.green.bold(`\n✔ Cycle ${i} saved to ${savePath}`));
        }

        // Save final content back to the main chapter file
        await fileUtils.saveChapter(selectedChapter, currentContent);
        console.log(chalk.green.bold(`\n✅ Final version of ${selectedChapter} published to chapters/${selectedChapter}.md`));

        console.log(chalk.cyan.bold(`\n✨ Evolution complete for ${selectedChapter}.\n`));
    });

program.parse(process.argv);
