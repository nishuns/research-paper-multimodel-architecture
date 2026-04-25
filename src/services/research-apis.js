const axios = require('axios');
const youtubesearchapi = require('youtube-search-api');

const DICTIONARY_API_URI = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const WIKIPEDIA_URI = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=";
const SERPAPI_API_KEY = "e3d7a65fba80c340f7a469b18a09328f505d9e27b7743c46625e1712fd049e44";

let wbkInstance = null;
async function getWbk() {
    if (!wbkInstance) {
        const { WBK } = await import('wikibase-sdk');
        wbkInstance = WBK({
            instance: 'https://www.wikidata.org',
            sparqlEndpoint: 'https://query.wikidata.org/sparql',
        });
    }
    return wbkInstance;
}

const researchServices = {
    googleSearch: async (query) => {
        const response = await axios.get("https://serpapi.com/search", {
            params: { q: query, api_key: SERPAPI_API_KEY, engine: "google" }
        });
        return response.data.organic_results || [];
    },

    youtubeSearch: async (query, limit = 5) => {
        const youtubeResponse = await youtubesearchapi.GetListByKeyword(query, limit);
        const items = youtubeResponse.items || [];
        
        return items.map((video) => {
            return {
                title: video.title,
                id: video.id,
                url: `https://www.youtube.com/watch?v=${video.id}`
            };
        });
    },

    wikipediaSearch: async (topic) => {
        const response = await axios.get(`${WIKIPEDIA_URI}${encodeURIComponent(topic)}`, {
            headers: {
                'User-Agent': 'ResearchEngineBot/1.0 (https://github.com/yourusername/research-engine; your@email.com)'
            }
        });
        const pages = response.data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId === "-1") return null;
        return pages[pageId].extract;
    },

    wikidataSearch: async (query) => {
        const wbk = await getWbk();
        const searchUrl = wbk.searchEntities({ search: query, language: 'en', limit: 5, format: 'json' });
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'ResearchEngineBot/1.0 (https://github.com/yourusername/research-engine; your@email.com)' }
        });
        return response.data.search || [];
    },

    wikidataImages: async (entityId) => {
        const wbk = await getWbk();
        const resultWikiUrl = wbk.getEntities({ ids: [entityId], props: ['claims'] });
        const response = await axios.get(resultWikiUrl, {
            headers: { 'User-Agent': 'ResearchEngineBot/1.0 (https://github.com/yourusername/research-engine; your@email.com)' }
        });
        const entity = response.data.entities[entityId];
        if (!entity || !entity.claims['P18']) return [];
        return entity.claims['P18'].map(claim => wbk.getImageUrl(claim.mainsnak.datavalue.value));
    },

    dictionaryLookup: async (word) => {
        const response = await axios.get(`${DICTIONARY_API_URI}${encodeURIComponent(word)}`);
        return response.data[0];
    }
};

module.exports = researchServices;
