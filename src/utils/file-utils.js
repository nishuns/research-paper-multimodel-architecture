const fs = require('fs-extra');
const path = require('path');

const CONFIG_PATH = './paper.config.json';

async function ensureProjectDirs() {
    await fs.ensureDir('./chapters');
    await fs.ensureDir('./drafts');
}

async function writeConfig(topic) {
    await fs.writeJson(CONFIG_PATH, { topic, updated: new Date() }, { spaces: 2 });
}

function configExists() {
    return fs.existsSync(CONFIG_PATH);
}

async function readChapter(chapter) {
    const filePath = path.join('./chapters', `${chapter}.md`);
    if (!fs.existsSync(filePath)) {
        await fs.writeFile(filePath, `# ${chapter}\nDraft notes here.`);
    }
    return await fs.readFile(filePath, 'utf-8');
}

async function saveDraft(chapter, cycle, content) {
    const savePath = `./drafts/${chapter}_cycle_${cycle}.md`;
    await fs.ensureDir('./drafts');
    await fs.writeFile(savePath, content);
    return savePath;
}

async function createIntroIfMissing(topic) {
    const introPath = './chapters/intro.md';
    if (!fs.existsSync(introPath)) {
        const starter = `# Introduction\n\nTopic: ${topic}\n\n[AI: Please generate the initial research introduction based on the topic above.]`;
        await fs.writeFile(introPath, starter);
    }
}

async function saveChapter(chapter, content) {
    const filePath = path.join('./chapters', `${chapter}.md`);
    await fs.writeFile(filePath, content);
    return filePath;
}

module.exports = {
    ensureProjectDirs,
    writeConfig,
    configExists,
    readChapter,
    saveChapter,
    saveDraft,
    createIntroIfMissing
};
