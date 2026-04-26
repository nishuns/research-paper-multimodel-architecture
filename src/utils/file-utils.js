const fs = require('fs-extra');
const path = require('path');

const CONFIG_PATH = './paper.config.json';

async function ensureProjectDirs() {
    await fs.ensureDir('./chapters');
    await fs.ensureDir('./drafts');
    await fs.ensureDir('./publish');
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

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

async function createInitialChapter(topic) {
    const slug = slugify(topic) || 'research-paper';
    const filePath = path.join('./chapters', `${slug}.md`);
    if (!fs.existsSync(filePath)) {
        const starter = `# ${topic}\n\n[AI: Please generate the comprehensive research paper introduction and preliminary outline for: ${topic}]`;
        await fs.writeFile(filePath, starter);
    }
    return slug;
}

async function saveChapter(chapter, content) {
    const filePath = path.join('./chapters', `${chapter}.md`);
    await fs.writeFile(filePath, content);
    return filePath;
}

async function savePublished(filename, content) {
    const filePath = path.join('./publish', filename);
    await fs.ensureDir('./publish');
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
    createInitialChapter,
    savePublished
};
