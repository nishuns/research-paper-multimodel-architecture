import { LMStudioClient, tool } from "@lmstudio/sdk";
import { z } from "zod";

const client = new LMStudioClient();

const multiplyTool = tool({
    name: "multiply",
    description: "Given two numbers a and b. Returns the product of them.",
    parameters: { a: z.number(), b: z.number() },
    implementation: ({ a, b }) => a * b,
});

const model = await client.llm.model("qwen2.5-7b-instruct");
await model.act("What is the result of 12345 multiplied by 54321?", [multiplyTool], {
    onMessage: (message) => console.info(message.toString()),
});