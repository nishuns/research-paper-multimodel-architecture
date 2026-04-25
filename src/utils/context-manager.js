const chalk = require('chalk');

class ContextManager {
    constructor(limit = 32000) {
        this.limit = limit;
        this.history = [];
        this.totalTokens = 0;
    }

    addMessage(role, content) {
        const tokens = this.estimateTokens(content);
        this.history.push({ role, content, tokens });
        this.totalTokens += tokens;
        
        console.log(chalk.dim(`[Context] Current load: ${this.totalTokens}/${this.limit} tokens`));
        
        if (this.totalTokens > this.limit * 0.8) {
            console.log(chalk.yellow(`[Context] Warning: Reaching ${this.limit} tokens. Consider summarizing.`));
        }
    }

    estimateTokens(text) {
        if (!text) return 0;
        // Simple heuristic: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    getHistory() {
        return this.history.map(m => ({ role: m.role, content: m.content }));
    }

    async summarize(model) {
        console.log(chalk.magenta(`\n[Context] Context limit reached. Summarizing history...`));
        
        const summaryPrompt = "Summarize the following research progress, key findings, and missing data points into a concise summary to preserve context for the next stage. Keep technical details intact.\n\n" + 
            this.history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

        const response = await model.respond([
            { role: 'system', content: 'You are a research coordinator.' },
            { role: 'user', content: summaryPrompt }
        ]);

        const summary = response.content;
        
        // Reset history with the summary as the new foundation
        this.history = [
            { role: 'system', content: 'Previous Research Summary: ' + summary, tokens: this.estimateTokens(summary) }
        ];
        this.totalTokens = this.history[0].tokens;
        
        console.log(chalk.green(`[Context] Context summarized. New load: ${this.totalTokens} tokens.`));
        return summary;
    }

    isFull() {
        return this.totalTokens >= this.limit;
    }
}

module.exports = ContextManager;
