const chalk = require('chalk');
const { Chat } = require('@lmstudio/sdk');
const logger = require('./src/utils/logger');
const tools = require('./src/tools/definitions');

/**
 * MOCK MODEL: Simulates an LLM that calls tools
 */
const mockModel = {
    id: "mock-model-v1",
    respond: async (chat, options) => {
        const turn = chat.messages.length;
        
        // Turn 1: Model decides to search
        if (turn <= 2) {
            return {
                role: 'assistant',
                content: "I need to research Quantum Computing trends in 2026.",
                toolCalls: [{
                    id: "call_123",
                    function: {
                        name: "google_search",
                        arguments: JSON.stringify({ query: "Quantum Computing Trends 2026" })
                    }
                }]
            };
        }
        
        // Turn 2: Model sees search results and decides to save a file
        if (turn <= 4) {
            return {
                role: 'assistant',
                content: "I found some great info. I will save this to a notes file.",
                toolCalls: [{
                    id: "call_456",
                    function: {
                        name: "create_file",
                        arguments: JSON.stringify({ 
                            name: "research_notes_mock.txt", 
                            content: "Top Trend: Topological Qubits are booming in 2026." 
                        })
                    }
                }]
            };
        }

        // Turn 3: Final Response
        return {
            role: 'assistant',
            content: "Research complete. I have found that Topological Qubits are the main trend for 2026 and I've saved the details to research_notes_mock.txt."
        };
    }
};

async function runMockTest() {
    console.log(chalk.blue.bold("🧪 Starting Mock Agentic Loop Test..."));
    
    const chat = Chat.empty();
    chat.append("system", "You are a research assistant.");
    chat.append("user", "What's trending in Quantum Computing?");

    let iterations = 0;
    const maxIterations = 5;
    let finalResponse = "";

    try {
        while (iterations < maxIterations) {
            iterations++;
            console.log(chalk.cyan(`   [MockAgent] Turn ${iterations}...`));

            const response = await mockModel.respond(chat);
            chat.append(response);

            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const tc of response.toolCalls) {
                    const toolName = tc.function.name;
                    const tool = tools.find(t => t.name === toolName);
                    
                    console.log(chalk.yellow(`      🛠️  Executing: ${toolName}`));
                    
                    let result;
                    if (tool) {
                        try {
                            const args = JSON.parse(tc.function.arguments);
                            result = await tool.implementation(args); 
                        } catch (e) {
                            result = `Error: ${e.message}`;
                        }
                    } else {
                        result = "Tool not found";
                    }
                    
                    console.log(chalk.gray(`      ✅ Result: ${result.substring(0, 40)}...`));
                    chat.appendToolResponse(tc, result);
                }
            } else {
                finalResponse = response.content;
                break;
            }
        }

        console.log(chalk.green.bold("\n✨ LOGIC TEST SUCCESSFUL!"));
        console.log(chalk.white("Final Answer:"), chalk.cyan(finalResponse));
        
        console.log(chalk.dim("\n📝 Verifying Log Generation..."));
        await logger.logConversation("Mock-Test-Topic", "mock-agent", "mock-model-id", chat.messages);
        console.log(chalk.green("✅ Logs written to logs/mock-test-topic/mock-agent.md"));

    } catch (err) {
        console.error(chalk.red("\n❌ LOGIC TEST FAILED:"), err);
        console.error(err.stack);
    }
}

runMockTest();
