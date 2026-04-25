const tools = require('../tools/definitions');
const chalk = require('chalk');

class ToolService {
    constructor() {
        this.tools = tools;
    }

    getToolDefinitions() {
        return this.tools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
    }

    async callTool(toolCall) {
        const { name, arguments: argsString } = toolCall.function;
        const tool = this.tools.find(t => t.name === name);

        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        let args;
        try {
            args = JSON.parse(argsString);
        } catch (e) {
            throw new Error(`Invalid arguments for tool ${name}: ${argsString}`);
        }

        console.log(chalk.yellow(`\n[Tool Call] Executing ${name} with args: ${JSON.stringify(args)}`));
        const result = await tool.handler(args);
        console.log(chalk.yellow(`[Tool Result] ${typeof result === 'string' ? result.substring(0, 50) + '...' : 'Data returned'}`));

        return result;
    }
}

module.exports = new ToolService();
