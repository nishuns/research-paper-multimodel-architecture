const tools = require('../tools/definitions');
const chalk = require('chalk');

/**
 * ToolService (Legacy Wrapper)
 * Updated to be compatible with the new rawFunctionTool definitions.
 */
class ToolService {
    constructor() {
        this.tools = tools;
    }

    /**
     * Returns tool definitions in a format suitable for some older manual loops
     * or other client implementations.
     */
    getToolDefinitions() {
        return this.tools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parametersJsonSchema // Using JSON Schema from rawFunctionTool
            }
        }));
    }

    /**
     * Executes a tool manually if needed.
     */
    async callTool(toolCall) {
        const { name, arguments: argsString } = toolCall.function;
        const tool = this.tools.find(t => t.name === name);

        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        let args;
        try {
            args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
        } catch (e) {
            throw new Error(`Invalid arguments for tool ${name}: ${argsString}`);
        }

        console.log(chalk.yellow(`\n[Tool Call] Executing ${name} with args: ${JSON.stringify(args)}`));
        // Use implementation instead of handler
        const result = await tool.implementation(args);
        console.log(chalk.yellow(`[Tool Result] ${typeof result === 'string' ? result.substring(0, 50) + '...' : 'Data returned'}`));

        return result;
    }
}

module.exports = new ToolService();
