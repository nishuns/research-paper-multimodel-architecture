const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const lmStudioService = require('../services/lmstudio');
const ResearchLogger = require('../utils/logger');
const tools = require('../tools/definitions');
const researchPrompts = require('../../prompts/research-prompts');
const ContextManager = require('../utils/context-manager');

const CONFIG_PATH = './paper.config.json';
const MODELS_PATH = './models.json';

async function handleManualToolCalls(model, context, toolsList, logger, metadata) {
    let lastResponse = context.history[context.history.length - 1];
    let iterations = 0;
    const maxIterations = 8; // Allow for deeper research

    while (iterations < maxIterations) {
        if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) {
            break; 
        }

        iterations++;
        const toolResults = [];

        for (const toolCall of lastResponse.toolCalls) {
            const toolDef = toolsList.find(t => t.name === toolCall.name);
            if (toolDef) {
                console.log(chalk.yellow(`   🛠️  [MANUAL TOOL CALL] ${toolCall.name}(${JSON.stringify(toolCall.parameters)})`));
                try {
                    const result = await toolDef.implementation(toolCall.parameters);
                    console.log(chalk.green(`   ✅ [TOOL RESULT] Success.`));
                    
                    await logger.logStep({
                        type: 'tool_execution',
                        ...metadata,
                        toolCall: { name: toolCall.name, parameters: toolCall.parameters },
                        toolResult: result,
                        contextTokens: context.totalTokens
                    });

                    toolResults.push({
                        role: "tool",
                        toolCallId: toolCall.id,
                        content: result
                    });
                    context.addMessage('tool', result);
                } catch (error) {
                    console.log(chalk.red(`   ❌ [TOOL ERROR] ${error.message}`));
                    
                    await logger.logStep({
                        type: 'tool_error',
                        ...metadata,
                        toolCall: { name: toolCall.name, parameters: toolCall.parameters },
                        toolResult: `Error: ${error.message}`,
                        contextTokens: context.totalTokens
                    });

                    toolResults.push({
                        role: "tool",
                        toolCallId: toolCall.id,
                        content: `Error: ${error.message}`
                    });
                    context.addMessage('tool', `Error: ${error.message}`);
                }
            }
        }

        const nextResponse = await model.respond(context.getHistory(), { tools: toolsList });
        context.addMessage('assistant', nextResponse.content || "[Tool Calls]");
        context.history[context.history.length - 1].toolCalls = nextResponse.toolCalls;
        
        await logger.logStep({
            type: 'model_response',
            ...metadata,
            content: nextResponse.content,
            toolCalls: nextResponse.toolCalls,
            contextTokens: context.totalTokens
        });

        if (nextResponse.content) {
            console.info(chalk.white(nextResponse.content));
        }
        
        lastResponse = context.history[context.history.length - 1];
    }
}

async function analyzeTopic(topic) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === 'critique') || config.available_models[0];
    const logger = new ResearchLogger(topic);

    console.log(chalk.blue(`\n[Architect] Analyzing topic: ${topic}...`));
    
    let model;
    try {
        model = await lmStudioService.loadModel(mCfg.id);
        const context = new ContextManager();
        
        const systemPrompt = researchPrompts.ANALYZE_TOPIC_SYSTEM;
        const userPrompt = researchPrompts.ANALYZE_TOPIC_INSTRUCTION(topic);
        
        context.addMessage('system', systemPrompt);
        context.addMessage('user', userPrompt);

        await logger.logStep({
            type: 'input_prompt',
            role: 'architect',
            model: mCfg.id,
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            contextSnapshot: context.getHistory(),
            contextTokens: context.totalTokens
        });

        const response = await model.respond(context.getHistory());
        const analysis = response.content;
        
        context.addMessage('assistant', analysis);
        console.info(chalk.white(analysis));

        await logger.logStep({
            type: 'model_output',
            role: 'architect',
            model: mCfg.id,
            content: analysis,
            contextTokens: context.totalTokens
        });

        if (fs.existsSync(CONFIG_PATH)) {
            const paper = fs.readJsonSync(CONFIG_PATH);
            paper.roadmap = analysis;
            fs.writeJsonSync(CONFIG_PATH, paper, { spaces: 2 });
        }

        console.log(chalk.green(`[Architect] Analysis complete.`));
        return analysis;
    } finally {
        if (model) await lmStudioService.unloadModel(model);
    }
}

async function suggestTopics(field) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === 'writer') || config.available_models[0];
    const displayField = field || "General Trends";
    const logger = new ResearchLogger(`Ideation-${displayField}`);

    console.log(chalk.blue(`\n[Ideator] Researching trends for: ${displayField}...`));
    
    let model;
    try {
        model = await lmStudioService.loadModel(mCfg.id);
        const context = new ContextManager();
        
        const systemPrompt = researchPrompts.SUGGEST_TOPICS_SYSTEM;
        const userPrompt = `FIELD: "${displayField}"\n\nINSTRUCTION: Before providing any suggestions, you MUST use your tools (youtube_search, google_search) to identify what is currently trending in this field. \n\n1. Identify 3-5 specific search queries.\n2. Call the tools with these queries.\n3. DO NOT output the final list of suggestions until you have received and analyzed the tool results.`;

        context.addMessage('system', systemPrompt);
        context.addMessage('user', userPrompt);

        await logger.logStep({
            type: 'research_planning',
            role: 'ideator',
            model: mCfg.id,
            prompt: userPrompt,
            contextSnapshot: context.getHistory(),
            contextTokens: context.totalTokens
        });

        const response = await model.respond(context.getHistory(), { tools });
        context.addMessage('assistant', response.content || "[Tool Calls]");
        context.history[context.history.length - 1].toolCalls = response.toolCalls;

        await logger.logStep({
            type: 'initial_response',
            role: 'ideator',
            model: mCfg.id,
            content: response.content,
            toolCalls: response.toolCalls,
            contextTokens: context.totalTokens
        });

        if (response.content) console.info(chalk.white(response.content));

        await handleManualToolCalls(model, context, tools, logger, { role: 'ideator', model: mCfg.id });
        
        if (context.history[context.history.length - 1].role !== 'assistant' || !context.history[context.history.length - 1].content || context.history[context.history.length - 1].content === "[Tool Calls]") {
            console.log(chalk.dim(`[Ideator] Requesting final synthesis based on research...`));
            const finalPrompt = "Based on the research results above, provide the final 5-10 research topic suggestions as originally instructed (Title, Explanation, Keywords).";
            context.addMessage('user', finalPrompt);
            
            const finalResponse = await model.respond(context.getHistory());
            context.addMessage('assistant', finalResponse.content);
            console.info(chalk.white(finalResponse.content));
            
            await logger.logStep({
                type: 'final_synthesis',
                role: 'ideator',
                model: mCfg.id,
                content: finalResponse.content,
                contextTokens: context.totalTokens
            });
        }

        const suggestions = context.history.filter(m => m.role === 'assistant' && m.content && m.content !== "[Tool Calls]").map(m => m.content).pop();
        
        console.log(chalk.white(`\n--- TREND-BASED TOPIC SUGGESTIONS ---\n`));
        console.log(chalk.cyan(suggestions || "No suggestions generated. Check logs."));
        console.log(chalk.white(`\n--------------------------------------\n`));
        
        return suggestions;
    } finally {
        if (model) await lmStudioService.unloadModel(model);
    }
}

async function runPhase(content, contextData, roleName, cycleNum = 1) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === roleName);

    if (!mCfg || !mCfg.enabled) return { content, resultText: null };

    const paper = fs.existsSync(CONFIG_PATH) ? fs.readJsonSync(CONFIG_PATH) : { topic: "Unknown", roadmap: "" };
    const roadmap = paper.roadmap || "Standard Research Evolution";
    const logger = new ResearchLogger(paper.topic);

    let model;
    try {
        model = await lmStudioService.loadModel(mCfg.id);
        const context = new ContextManager();
        
        const systemPrompt = researchPrompts.EVOLVE_SYSTEM(paper.topic, roadmap);
        const userPrompt = researchPrompts.EVOLVE_INSTRUCTION(paper.topic, contextData) + `\n\nCURRENT CONTENT:\n${content}`;

        context.addMessage('system', systemPrompt);
        context.addMessage('user', userPrompt);

        console.log(chalk.cyan(`[Agent] ${roleName} is working (Cycle ${cycleNum})...`));
        
        await logger.logStep({
            type: 'phase_start',
            role: roleName,
            model: mCfg.id,
            cycle: cycleNum,
            prompt: userPrompt,
            contextSnapshot: context.getHistory(),
            contextTokens: context.totalTokens
        });

        const response = await model.respond(context.getHistory(), { tools });
        context.addMessage('assistant', response.content || "[Tool Calls]");
        context.history[context.history.length - 1].toolCalls = response.toolCalls;

        await logger.logStep({
            type: 'model_initial_response',
            role: roleName,
            model: mCfg.id,
            cycle: cycleNum,
            content: response.content,
            toolCalls: response.toolCalls,
            contextTokens: context.totalTokens
        });

        if (response.content) console.info(chalk.white(response.content));

        await handleManualToolCalls(model, context, tools, logger, { role: roleName, model: mCfg.id, cycle: cycleNum });

        let finalResult = context.history[context.history.length - 1].content;
        if (context.history[context.history.length - 1].role === 'tool' || finalResult === "[Tool Calls]") {
             const finalResponse = await model.respond(context.getHistory());
             finalResult = finalResponse.content;
             context.addMessage('assistant', finalResult);
             console.info(chalk.white(finalResult));
        }

        if (context.isFull()) {
            const summary = await context.summarize(model);
            await logger.logStep({
                type: 'context_summarization',
                role: roleName,
                model: mCfg.id,
                cycle: cycleNum,
                content: summary,
                contextTokens: context.totalTokens
            });
        }

        await logger.logStep({
            type: 'phase_complete',
            role: roleName,
            model: mCfg.id,
            cycle: cycleNum,
            finalContent: finalResult,
            contextTokens: context.totalTokens
        });

        return {
            content: (roleName === 'critique') ? content : finalResult,
            resultText: finalResult
        };
    } finally {
        if (model) await lmStudioService.unloadModel(model);
    }
}

module.exports = { runPhase, analyzeTopic, suggestTopics };
