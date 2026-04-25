const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class ResearchLogger {
    constructor(topic) {
        this.topic = topic;
        this.topicSlug = (topic || "unknown").toLowerCase().replace(/[^a-z0-9]/g, '-');
        this.logDir = path.join('logs', this.topicSlug);
        this.traceFile = path.join(this.logDir, 'detailed-trace.json');
        this.mdFile = path.join(this.logDir, 'summary.md');
        
        fs.ensureDirSync(this.logDir);
    }

    async logStep(data) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            ...data
        };

        // Append to JSON trace for deep inspection
        let trace = [];
        if (fs.existsSync(this.traceFile)) {
            trace = await fs.readJson(this.traceFile);
        }
        trace.push(entry);
        await fs.writeJson(this.traceFile, trace, { spaces: 2 });

        // Append to Markdown for readability
        await this.appendToMarkdown(entry);
    }

    async appendToMarkdown(entry) {
        let content = `\n## [${entry.timestamp}] ${entry.type.toUpperCase()}\n`;
        
        if (entry.model) content += `**Model:** \`${entry.model}\`\n`;
        if (entry.role) content += `**Role:** \`${entry.role}\`\n`;
        if (entry.cycle) content += `**Cycle:** ${entry.cycle}\n`;
        
        if (entry.prompt) {
            content += `### Prompt\n\`\`\`text\n${entry.prompt}\n\`\`\`\n`;
        }

        if (entry.content) {
            content += `### Response Content\n${entry.content}\n`;
        }

        if (entry.toolCall) {
            content += `### 🛠️ Tool Call: \`${entry.toolCall.name}\`\n`;
            content += `**Parameters:**\n\`\`\`json\n${JSON.stringify(entry.toolCall.parameters, null, 2)}\n\`\`\`\n`;
        }

        if (entry.toolResult) {
            content += `**Result:**\n\`\`\`text\n${entry.toolResult}\n\`\`\`\n`;
        }

        if (entry.contextTokens) {
            content += `\n*Context Load: ${entry.contextTokens} tokens*\n`;
        }

        content += `\n---\n`;
        await fs.appendFile(this.mdFile, content);
    }

    static async logConversation(topic, role, modelId, conversation) {
        // Compatibility wrapper for existing code
        const logger = new ResearchLogger(topic);
        await logger.logStep({
            type: 'conversation_snapshot',
            role,
            model: modelId,
            content: "Snapshot of full conversation history logged to trace.json"
        });
    }
}

module.exports = ResearchLogger;
