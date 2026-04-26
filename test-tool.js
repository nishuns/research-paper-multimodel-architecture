import { LMStudioClient, rawFunctionTool } from "@lmstudio/sdk";
import researchServices from "./src/services/research-apis.js";

const client = new LMStudioClient();

/**
 * Tool to search for AI trends and topics using rawFunctionTool (as per test-prime.js style).
 */
const searchTool = rawFunctionTool({
    name: "search",
    description: "Search the web for information. Use this to find trendy AI topics.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            query: { type: "string", description: "The search query to look up" },
        },
        required: ["query"],
    },
    implementation: async ({ query }) => {
        console.log(`\n[Tool: Search] Querying: "${query}"`);
        try {
            const results = await researchServices.googleSearch(query);
            return results;
        } catch (err) {
            return `Search failed: ${err.message}`;
        }
    },
});

/**
 * The 'add' tool using rawFunctionTool.
 */
const addTool = rawFunctionTool({
    name: "add",
    description: "Calculate the sum of two numbers",
    parametersJsonSchema: {
        type: "object",
        properties: {
            a: { type: "number", description: "First number" },
            b: { type: "number", description: "Second number" },
        },
        required: ["a", "b"],
    },
    implementation: ({ a, b }) => {
        console.log(`\n[Tool: Add] Adding ${a} + ${b}`);
        return a + b;
    },
});

async function main() {
    console.log("Connecting to LM Studio...");
    try {
        // Using the preferred model reference method
        const model = await client.llm.model("qwen2.5-7b-instruct");
        console.log("Model referenced. Starting research task...");

        const prompt = "Search for the top 3 trendy topics in AI right now. Please provide the specific names of these topics.";

        // Using model.act as seen in test-prime.js
        await model.act(prompt, [searchTool, addTool], {
            onMessage: (message) => {
                const msg = message.toString();
                if (msg.trim()) {
                    console.info(msg);
                }
            },
        });

        console.log("\nResearch complete.");
    } catch (error) {
        console.error("\n--- Execution Error ---");
        console.error(error.message);
    }
}

main();
