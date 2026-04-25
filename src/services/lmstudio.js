const { LMStudioClient } = require('@lmstudio/sdk');
const chalk = require('chalk');

class LMStudioService {
    constructor() {
        this.client = new LMStudioClient();
    }

    async loadModel(modelId) {
        console.log(chalk.blue(`\n[SDK] Loading model: ${modelId}...`));
        return await this.client.llm.load(modelId, { ttl: 60 });
    }

    async unloadModel(model) {
        if (model) {
            console.log(chalk.dim(`[SDK] Unloading ${model.identifier || 'model'}...`));
            await model.unload();
        }
    }
}

module.exports = new LMStudioService();
