const { rawFunctionTool } = require("@lmstudio/sdk");
const researchServices = require('../services/research-apis');
const fs = require('fs-extra');
const path = require('path');

const googleSearchTool = rawFunctionTool({
    name: "google_search",
    description: "Perform a Google search to find up-to-date information, news, or specific research data.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            query: { type: "string", description: "The search query to send to Google." }
        },
        required: ["query"]
    },
    implementation: async ({ query }) => {
        try {
            console.log(`\n[Tool: Google Search] Query: ${query}`);
            const results = await researchServices.googleSearch(query);
            return results.slice(0, 3).map(r => `${r.title}: ${r.snippet} (${r.link})`).join("\n\n") || "No results found.";
        } catch (error) {
            return `Error performing Google search: ${error.message}`;
        }
    }
});

const youtubeSearchTool = rawFunctionTool({
    name: "youtube_search",
    description: "Search YouTube for videos related to a topic to identify trends or find educational content.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            query: { type: "string", description: "The search query for YouTube videos." }
        },
        required: ["query"]
    },
    implementation: async ({ query }) => {
        try {
            console.log(`\n[Tool: YouTube Search] Query: ${query}`);
            const results = await researchServices.youtubeSearch(query, 5);
            return results.map(v => `Title: ${v.title}\nURL: ${v.url}`).join("\n\n") || "No videos found.";
        } catch (error) {
            return `Error searching YouTube: ${error.message}`;
        }
    }
});

const wikipediaSearchTool = rawFunctionTool({
    name: "wikipedia_search",
    description: "Search Wikipedia for a specific topic to get a summary and factual data.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            topic: { type: "string", description: "The topic to search on Wikipedia." }
        },
        required: ["topic"]
    },
    implementation: async ({ topic }) => {
        try {
            console.log(`\n[Tool: Wikipedia] Topic: ${topic}`);
            const extract = await researchServices.wikipediaSearch(topic);
            if (!extract) return `No Wikipedia page found for "${topic}".`;
            return extract;
        } catch (error) {
            return `Error fetching from Wikipedia: ${error.message}`;
        }
    }
});

const readChapterTool = rawFunctionTool({
    name: "read_chapter",
    description: "Read the content of an existing chapter from the research project.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            chapterName: { type: "string", description: "The name of the chapter (e.g., 'intro')." }
        },
        required: ["chapterName"]
    },
    implementation: async ({ chapterName }) => {
        const filePath = path.join('./chapters', `${chapterName}.md`);
        if (!fs.existsSync(filePath)) return `Error: Chapter ${chapterName} not found.`;
        return await fs.readFile(filePath, 'utf-8');
    }
});

const writeChapterTool = rawFunctionTool({
    name: "write_chapter",
    description: "Save or update research content to a chapter file.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            chapterName: { type: "string", description: "The name of the chapter." },
            content: { type: "string", description: "The markdown content to write." }
        },
        required: ["chapterName", "content"]
    },
    implementation: async ({ chapterName, content }) => {
        const filePath = path.join('./chapters', `${chapterName}.md`);
        await fs.ensureDir('./chapters');
        await fs.writeFile(filePath, content);
        return `Successfully saved ${chapterName}.`;
    }
});

const createFileTool = rawFunctionTool({
    name: "create_file",
    description: "Create a new file with a specific name and content.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            name: { type: "string", description: "The name of the file to create (including extension)." },
            content: { type: "string", description: "The text content to write into the file." }
        },
        required: ["name", "content"]
    },
    implementation: async ({ name, content }) => {
        if (fs.existsSync(name)) return "Error: File already exists.";
        try {
            await fs.writeFile(name, content, "utf-8");
            return `File '${name}' created successfully.`;
        } catch (e) {
            return `Error creating file: ${e.message}`;
        }
    },
});

module.exports = [
    googleSearchTool,
    youtubeSearchTool,
    wikipediaSearchTool,
    readChapterTool,
    writeChapterTool,
    createFileTool
];
