const { tool } = require("@lmstudio/sdk");
const { z } = require("zod");
const researchServices = require('../services/research-apis');

const googleSearchTool = tool({
    name: "google_search",
    description: "Perform a Google search to find up-to-date information, news, or specific research data.",
    parameters: { query: z.string().describe("The search query to send to Google.") },
    implementation: async ({ query }) => {
        try {
            const results = await researchServices.googleSearch(query);
            return results.slice(0, 3).map(r => `${r.title}: ${r.snippet} (${r.link})`).join("\n\n") || "No results found.";
        } catch (error) {
            return `Error performing Google search: ${error.message}`;
        }
    }
});

const youtubeSearchTool = tool({
    name: "youtube_search",
    description: "Search YouTube for videos related to a topic.",
    parameters: { query: z.string().describe("The search query for YouTube videos.") },
    implementation: async ({ query }) => {
        try {
            const results = await researchServices.youtubeSearch(query, 5);
            return results.map(v => `Title: ${v.title}\nURL: ${v.url}`).join("\n\n") || "No videos found.";
        } catch (error) {
            return `Error searching YouTube: ${error.message}`;
        }
    }
});

const wikipediaSearchTool = tool({
    name: "wikipedia_search",
    description: "Search Wikipedia for a specific topic to get a summary and factual data.",
    parameters: { topic: z.string().describe("The topic to search on Wikipedia.") },
    implementation: async ({ topic }) => {
        try {
            const extract = await researchServices.wikipediaSearch(topic);
            if (!extract) return `No Wikipedia page found for "${topic}".`;
            return extract;
        } catch (error) {
            return `Error fetching from Wikipedia: ${error.message}`;
        }
    }
});

const wikidataSearchTool = tool({
    name: "wikidata_search",
    description: "Search Wikidata for entities to get their IDs and descriptions.",
    parameters: { query: z.string().describe("The entity or concept to search for in Wikidata.") },
    implementation: async ({ query }) => {
        try {
            const results = await researchServices.wikidataSearch(query);
            if (results.length === 0) return `No Wikidata entities found for "${query}".`;
            return results.map(r => `${r.label} (${r.id}): ${r.description || 'No description'}`).join("\n");
        } catch (error) {
            return `Error searching Wikidata: ${error.message}`;
        }
    }
});

const wikidataImagesTool = tool({
    name: "wikidata_images",
    description: "Get image URLs for a specific Wikidata entity ID (e.g., Q42).",
    parameters: { entityId: z.string().describe("The Wikidata entity ID (e.g., 'Q42' for Douglas Adams).") },
    implementation: async ({ entityId }) => {
        try {
            const images = await researchServices.wikidataImages(entityId);
            if (images.length === 0) return `No images found for entity ${entityId}.`;
            return `Images for ${entityId}:\n${images.join("\n")}`;
        } catch (error) {
            return `Error fetching Wikidata images: ${error.message}`;
        }
    }
});

const dictionaryLookupTool = tool({
    name: "dictionary_lookup",
    description: "Look up the definition, phonetics, and usage of an English word.",
    parameters: { word: z.string().describe("The word to look up.") },
    implementation: async ({ word }) => {
        try {
            const data = await researchServices.dictionaryLookup(word);
            const definition = data.meanings[0].definitions[0].definition;
            return `Word: ${data.word}\nDefinition: ${definition}`;
        } catch (error) {
            return `Error looking up word "${word}": ${error.message}`;
        }
    }
});

const readChapterTool = tool({
    name: "read_chapter",
    description: "Read the content of an existing chapter.",
    parameters: { chapterName: z.string().describe("The name of the chapter (e.g., 'intro').") },
    implementation: async ({ chapterName }) => {
        const fs = require('fs-extra');
        const path = require('path');
        const filePath = path.join('./chapters', `${chapterName}.md`);
        if (!fs.existsSync(filePath)) return `Error: Chapter ${chapterName} not found.`;
        return await fs.readFile(filePath, 'utf-8');
    }
});

const writeChapterTool = tool({
    name: "write_chapter",
    description: "Save or update research content to a chapter file.",
    parameters: {
        chapterName: z.string().describe("The name of the chapter."),
        content: z.string().describe("The markdown content to write.")
    },
    implementation: async ({ chapterName, content }) => {
        const fs = require('fs-extra');
        const path = require('path');
        const filePath = path.join('./chapters', `${chapterName}.md`);
        await fs.ensureDir('./chapters');
        await fs.writeFile(filePath, content);
        return `Successfully saved ${chapterName}.`;
    }
});

const createFileTool = tool({
    name: "create_file",
    description: "Create a new file with a specific name and content.",
    parameters: {
        name: z.string().describe("The name of the file to create (including extension)."),
        content: z.string().describe("The text content to write into the file.")
    },
    implementation: async ({ name, content }) => {
        const fs = require('fs-extra');
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
    wikidataSearchTool,
    wikidataImagesTool,
    dictionaryLookupTool,
    readChapterTool,
    writeChapterTool,
    createFileTool
];
