const chalk = require('chalk');
const services = require('./src/services/research-apis');

async function testServices() {
    console.log(chalk.blue.bold("🚀 Starting API Services Test...\n"));

    try {
        console.log(chalk.cyan("1. Testing Google Search..."));
        const googleRes = await services.googleSearch("Quantum Computing");
        console.log(chalk.green(`   ✅ Success! Found ${googleRes.length} results. First result: ${googleRes[0]?.title}`));

        console.log(chalk.cyan("\n2. Testing YouTube Search..."));
        const ytRes = await services.youtubeSearch("Quantum Computing", 2);
        console.log(chalk.green(`   ✅ Success! Found ${ytRes.length} videos.`));
        if (ytRes.length > 0) {
            console.log(chalk.gray(`      First video: ${ytRes[0].title}`));
        }

        console.log(chalk.cyan("\n3. Testing Wikipedia Search..."));
        const wikiRes = await services.wikipediaSearch("Quantum Computing");
        console.log(chalk.green(`   ✅ Success! Extract length: ${wikiRes?.length} characters.`));

        console.log(chalk.cyan("\n4. Testing Wikidata Search..."));
        const wdSearchRes = await services.wikidataSearch("Douglas Adams");
        console.log(chalk.green(`   ✅ Success! Found ${wdSearchRes.length} entities. First entity ID: ${wdSearchRes[0]?.id}`));

        if (wdSearchRes.length > 0) {
            console.log(chalk.cyan(`\n5. Testing Wikidata Images for ${wdSearchRes[0].id}...`));
            const wdImages = await services.wikidataImages(wdSearchRes[0].id);
            console.log(chalk.green(`   ✅ Success! Found ${wdImages.length} images. First image: ${wdImages[0]}`));
        }

        console.log(chalk.cyan("\n6. Testing Dictionary Lookup..."));
        const dictRes = await services.dictionaryLookup("Quantum");
        console.log(chalk.green(`   ✅ Success! Definition: ${dictRes?.meanings[0]?.definitions[0]?.definition}`));

        console.log(chalk.blue.bold("\n✨ ALL SERVICES TESTED SUCCESSFULLY!"));
    } catch (e) {
        console.error(chalk.red("\n❌ Test Failed:"), e.message);
        if (e.response && e.response.data) {
            console.error(chalk.red(JSON.stringify(e.response.data, null, 2)));
        }
    }
}

testServices();
