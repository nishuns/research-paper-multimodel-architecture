import { LMStudioClient, rawFunctionTool } from "@lmstudio/sdk";
import researchServices from "./src/services/research-apis.js";

const client = new LMStudioClient();

// 1. Define the Search Tool using raw JSON Schema
const searchTool = rawFunctionTool({
    name: "search",
    description: "Search the web for information about AI and technology.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query to look up"
            },
        },
        required: ["query"],
    },
    implementation: async (params) => {
        const { query } = params;
        console.log(`\n[Tool] Executing Google Search for: ${query}`);
        try {
            return await researchServices.googleSearch(query);
        } catch (err) {
            return `Search failed: ${err.message}`;
        }
    },
});

// 2. Define the Multiply Tool using raw JSON Schema
const multiplyTool = rawFunctionTool({
    name: "multiply",
    description: "Returns the product of two numbers a and b.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            a: { type: "number" },
            b: { type: "number" },
        },
        required: ["a", "b"],
    },
    implementation: (params) => {
        const { a, b } = params;
        console.log(`\n[Tool] Calculating: ${a} * ${b}`);
        return a * b;
    },
});

async function main() {
    console.log("Connecting to LM Studio...");
    try {
        const model = await client.llm.model("qwen2.5-7b-instruct");
        console.log("Model loaded successfully.");

        const prompt = "What are the top 3 trendy topics in AI right now? Also, what is 123 multiplied by 456?";

        console.log(`Asking: "${prompt}"`);

        await model.act(prompt, [searchTool, multiplyTool], {
            onMessage: (message) => {
                // This captures thought, tool calls, and final response
                console.info(message.toString());
            },
        });

    } catch (error) {
        console.error("\n--- Execution Error ---");
        console.error(error.message);
    }
}

main();