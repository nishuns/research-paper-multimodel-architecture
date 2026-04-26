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

/**
 * Modernized Tool Handler using model.act pattern.
 * This replaces the previous manual tool calling loop.
 */
async function performAct(model, userPrompt, systemPrompt, toolsList, logger, metadata) {
    console.log(chalk.cyan(`   🚀 [Act] Starting interaction with tools...`));
    
    let accumulatedContent = "";

    const response = await model.act(userPrompt, toolsList, {
        systemPrompt: systemPrompt,
        onMessage: (message) => {
            const msgStr = message.toString();
            if (msgStr.trim()) {
                console.info(chalk.white(msgStr));
                accumulatedContent += msgStr;
            }
        },
    });

    // Use accumulated content if response.content is empty
    if (!response.content || response.content.length < accumulatedContent.length) {
        response.content = accumulatedContent;
    }

    if (!response.content && response.messages) {
        // Final fallback: try to get content from messages
        const lastAssistantMessage = [...response.messages].reverse().find(m => m.role === 'assistant' && m.content);
        if (lastAssistantMessage) {
            response.content = lastAssistantMessage.content;
        }
    }

    // Log the final result and tool usage summary
    await logger.logStep({
        type: 'act_complete',
        ...metadata,
        content: response.content,
        toolCalls: response.toolCalls,
        predictionStatus: response.predictionStatus
    });

    return response;
}

async function analyzeTopic(topic) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === 'critique') || config.available_models[0];
    const logger = new ResearchLogger(topic);

    console.log(chalk.blue(`\n[Architect] Analyzing topic: ${topic}...`));
    
    let model;
    try {
        model = await lmStudioService.loadModel(mCfg.id);
        
        const systemPrompt = researchPrompts.ANALYZE_TOPIC_SYSTEM;
        const userPrompt = researchPrompts.ANALYZE_TOPIC_INSTRUCTION(topic);
        
        // Setup phase now also uses tools for better architectural planning
        const response = await performAct(model, userPrompt, systemPrompt, tools, logger, { role: 'architect', model: mCfg.id });
        const analysis = response.content;
        
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

const TOPIC_SCHEMA = {
    type: "object",
    properties: {
        topics: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    explanation: { type: "string" },
                    keywords: { type: "array", items: { type: "string" } }
                },
                required: ["title", "explanation", "keywords"]
            }
        }
    },
    required: ["topics"]
};

async function suggestTopics(field) {
    const config = fs.readJsonSync(MODELS_PATH);
    const mCfg = config.available_models.find(m => m.role === 'writer') || config.available_models[0];
    const fCfg = config.available_models.find(m => m.role === 'formatter') || mCfg;
    const displayField = field || "General Trends";
    const logger = new ResearchLogger(`Ideation-${displayField}`);

    console.log(chalk.blue(`\n[Ideator] Researching trends for: ${displayField}...`));
    
    let model;
    let rawContent;
    try {
        model = await lmStudioService.loadModel(mCfg.id);
        
        const systemPrompt = researchPrompts.SUGGEST_TOPICS_SYSTEM;
        const userPrompt = researchPrompts.SUGGEST_TOPICS_INSTRUCTION(field);

        // Step 1: Use tools to gather information (Ideator)
        const response = await performAct(model, userPrompt, systemPrompt, tools, logger, { role: 'ideator', model: mCfg.id });
        rawContent = response.content;
        
        if (!rawContent && response.messages) {
            const lastMsg = response.messages.filter(m => m.role === 'assistant').pop();
            rawContent = lastMsg ? lastMsg.content : null;
        }

        console.log(chalk.dim(`   (Raw ideation content captured, length: ${rawContent ? rawContent.length : 0})`));
    } finally {
        if (model) await lmStudioService.unloadModel(model);
    }

    if (!rawContent) {
        console.log(chalk.red("❌ No raw content generated for suggestions."));
        return [];
    }

    // Step 2: Use structured output with the formatter model
    console.log(chalk.cyan(`\n   ✨ Loading Formatter (${fCfg.name}) to generate JSON...`));
    let formatterModel;
    try {
        formatterModel = await lmStudioService.loadModel(fCfg.id);
        
        const structuredResponse = await formatterModel.respond(
            `Extract the research topics from the following text into the required JSON format:\n\n${rawContent}`, 
            {
                systemPrompt: "You are a JSON formatter. You MUST output ONLY valid JSON. NO talk, NO markdown blocks, NO explanations. Just the JSON object matching the provided schema.",
                structured: {
                    type: "json",
                    jsonSchema: TOPIC_SCHEMA
                }
            }
        );

        let content = structuredResponse.content.trim();
        console.log(chalk.dim(`   (Formatter output captured, length: ${content.length})`));

        // Extremely robust JSON extraction
        let data;
        try {
            // Try direct parse
            data = JSON.parse(content);
        } catch (e) {
            // Try stripping markdown blocks
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    data = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    throw new Error("Failed to parse extracted JSON.");
                }
            } else {
                throw new Error("No JSON structure found in response.");
            }
        }

        const titles = data.topics.map(t => t.title);
        
        if (titles.length > 0) {
            const suggestionsPath = './suggestions.json';
            let existingSuggestions = [];
            if (fs.existsSync(suggestionsPath)) {
                existingSuggestions = fs.readJsonSync(suggestionsPath);
            }
            const updatedSuggestions = Array.from(new Set([...existingSuggestions, ...titles]));
            fs.writeJsonSync(suggestionsPath, updatedSuggestions, { spaces: 2 });
            console.log(chalk.green(`\n✅ ${titles.length} topics saved to suggestions.json`));
        }

        console.log(chalk.white(`\n--- TOPIC SUGGESTIONS ---\n`));
        data.topics.forEach((t, i) => {
            console.log(chalk.cyan(`${i + 1}. **${t.title}**`));
            console.log(chalk.white(`   ${t.explanation}`));
            console.log(chalk.dim(`   Keywords: ${t.keywords.join(', ')}\n`));
        });
        console.log(chalk.white(`--------------------------\n`));
        
        return data.topics;
    } catch (err) {
        console.log(chalk.red(`❌ Formatting Error: ${err.message}`));
        return [];
    } finally {
        if (formatterModel) await lmStudioService.unloadModel(formatterModel);
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
        
        const systemPrompt = researchPrompts.EVOLVE_SYSTEM(paper.topic, roadmap);
        const userPrompt = researchPrompts.EVOLVE_INSTRUCTION(paper.topic, contextData) + `\n\nCURRENT CONTENT:\n${content}`;

        console.log(chalk.cyan(`[Agent] ${roleName} is working (Cycle ${cycleNum})...`));
        
        const response = await performAct(model, userPrompt, systemPrompt, tools, logger, { 
            role: roleName, 
            model: mCfg.id, 
            cycle: cycleNum 
        });

        const finalResult = response.content;

        await logger.logStep({
            type: 'phase_complete',
            role: roleName,
            model: mCfg.id,
            cycle: cycleNum,
            finalContent: finalResult
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
