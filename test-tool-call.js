const { LMStudioClient, tool } = require("@lmstudio/sdk");
const { z } = require("zod");
const chalk = require("chalk");

async function runToolTest() {
    console.log(chalk.blue("🚀 Starting Verbose Tool Call Test..."));
    const client = new LMStudioClient();

    const isPrimeTool = tool({
        name: "check_prime",
        description: "Check if a given number is a prime number.",
        parameters: { 
            number: z.number().describe("The number to check") 
        },
        implementation: async ({ number }) => {
            console.log(chalk.magenta(`   [Tool Executing] Checking ${number}...`));
            if (number <= 1) return `${number} is not prime.`;
            for (let i = 2; i <= Math.sqrt(number); i++) {
                if (number % i === 0) return `${number} is not prime.`;
            }
            return `${number} is prime.`;
        },
    });

    try {
        const modelId = "qwen/qwen3.5-9b"; 
        console.log(chalk.dim(`⏳ Loading model: ${modelId}`));
        
        const model = await client.llm.load(modelId, { ttl: 60 });
        console.log(chalk.green(`✅ Model loaded successfully.`));

        console.log(chalk.cyan(`\n💬 Prompting...`));
        const prompt = "Use the check_prime tool to see if 7919 is a prime number.";
        
        // Use a more generic onMessage to see EVERYTHING
        await model.act(prompt, [isPrimeTool], {
            onMessage: (message) => {
                console.log(chalk.gray(`[SDK Message] Role: ${message.role}`));
                if (message.content) {
                    console.log(chalk.white(`   Content: ${message.content}`));
                }
                if (message.toolCalls) {
                    message.toolCalls.forEach(tc => {
                        console.log(chalk.yellow(`   🛠️  Tool Call: ${tc.function.name}(${tc.function.arguments})`));
                    });
                }
                if (message.toolResults) {
                    message.toolResults.forEach(tr => {
                        console.log(chalk.green(`   ✅ Tool Result: ${tr.content}`));
                    });
                }
            },
        });

        console.log(chalk.blue(`\n♻️ Unloading...`));
        await model.unload();
        console.log(chalk.green(`✅ Test complete.`));

    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
    }
}

runToolTest();
