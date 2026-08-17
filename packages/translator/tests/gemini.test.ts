import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildAntigravityContents,
    buildAntigravityTools,
    cleanJSONSchemaForAntigravity,
    parseAntigravityModelName
} from "../src/gemini.js";
import type { ChatCompletionRequest } from "@srouter/types";

test("buildAntigravityContents produces valid parts without empty text in oneof functionCall / functionResponse", () => {
    const req: ChatCompletionRequest = {
        model: "antigravity/gemini-2.5-pro",
        messages: [
            { role: "user", content: "What is the weather in Tokyo?" },
            {
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: "call_weather_1",
                        type: "function",
                        function: {
                            name: "get_weather",
                            arguments: JSON.stringify({ location: "Tokyo" })
                        }
                    }
                ]
            },
            {
                role: "tool",
                tool_call_id: "call_weather_1",
                content: JSON.stringify({ temperature: "22C", condition: "Sunny" })
            }
        ]
    };

    const contents = buildAntigravityContents(req);
    assert.equal(contents.length, 3);

    // 1. User message
    assert.equal(contents[0]?.role, "user");
    assert.equal(contents[0]?.parts[0]?.text, "What is the weather in Tokyo?");

    // 2. Assistant message with functionCall
    assert.equal(contents[1]?.role, "model");
    const modelPart = contents[1]?.parts[0];
    assert.ok(modelPart?.functionCall);
    assert.equal(modelPart.functionCall.name, "get_weather");
    assert.deepEqual(modelPart.functionCall.args, { location: "Tokyo" });
    // Verify text is undefined (not empty string) to satisfy protobuf oneof constraint
    assert.equal(modelPart.text, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(modelPart, "text"), false);

    // 3. Tool response message with functionResponse
    assert.equal(contents[2]?.role, "user");
    const toolPart = contents[2]?.parts[0];
    assert.ok(toolPart?.functionResponse);
    assert.equal(toolPart.functionResponse.name, "get_weather");
    assert.deepEqual(toolPart.functionResponse.response, {
        temperature: "22C",
        condition: "Sunny"
    });
    // Verify text is undefined (not empty string) to satisfy protobuf oneof constraint
    assert.equal(toolPart.text, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(toolPart, "text"), false);
});

test("cleanJSONSchemaForAntigravity fills missing array items", () => {
    const cleaned = cleanJSONSchemaForAntigravity({
        type: "object",
        properties: {
            choices: { type: "array", description: "Options" },
            tasks: { type: "ARRAY" },
            todos: {
                type: "array",
                prefixItems: [{ type: "object", properties: { id: { type: "string" } } }]
            },
            region: { type: "array", contains: { type: "number" } },
            nested: {
                type: "object",
                properties: { tags: { type: "array" } }
            },
            keep: { type: "array", items: { type: "number" } }
        }
    }) as Record<string, Record<string, Record<string, unknown>>>;

    const props = cleaned.properties;
    assert.deepEqual(props.choices?.items, { type: "string" });
    assert.deepEqual(props.tasks?.items, { type: "string" });
    assert.deepEqual(props.todos?.items, {
        type: "object",
        properties: { id: { type: "string" } }
    });
    assert.equal(Object.prototype.hasOwnProperty.call(props.todos ?? {}, "prefixItems"), false);
    assert.deepEqual(props.region?.items, { type: "number" });
    assert.deepEqual(
        (props.nested?.properties as Record<string, Record<string, unknown>>)?.tags?.items,
        { type: "string" }
    );
    assert.deepEqual(props.keep?.items, { type: "number" });
});

test("buildAntigravityTools emits array items for every declaration", () => {
    const req: ChatCompletionRequest = {
        model: "antigravity/gemini-3.7-flash-high",
        messages: [{ role: "user", content: "hi" }],
        tools: [
            {
                type: "function",
                function: {
                    name: "clarify",
                    description: "Ask a question",
                    parameters: {
                        type: "object",
                        properties: { choices: { type: "array" } },
                        required: ["choices"]
                    }
                }
            }
        ]
    } as ChatCompletionRequest;

    const tools = buildAntigravityTools(req);
    const declarations = tools[0]?.functionDeclarations as Array<{
        parameters: { properties: Record<string, Record<string, unknown>> };
    }>;
    assert.equal(declarations.length, 1);
    assert.deepEqual(declarations[0]?.parameters.properties.choices?.items, { type: "string" });
});

test("parseAntigravityModelName maps public ids to CloudCode internal ids", () => {
    assert.equal(
        parseAntigravityModelName("antigravity/gemini-3.7-flash-high"),
        "gemini-3.7-flash-tiered"
    );
    assert.equal(parseAntigravityModelName("gemini-3.7-flash-medium"), "gemini-3.7-flash-tiered");
    assert.equal(parseAntigravityModelName("gemini-3.7-flash-low"), "gemini-3.7-flash-tiered");
    assert.equal(parseAntigravityModelName("gemini-3.5-flash-high"), "gemini-3-flash-agent");
    assert.equal(parseAntigravityModelName("gemini-3.1-pro-high"), "gemini-pro-agent");
    assert.equal(parseAntigravityModelName("gemini-3.5-flash-medium"), "gemini-3.5-flash-low");
    assert.equal(parseAntigravityModelName("gemini-3.5-flash-low"), "gemini-3.5-flash-extra-low");
    // pass-through
    assert.equal(
        parseAntigravityModelName("antigravity/gemini-3.6-flash-high"),
        "gemini-3.6-flash-high"
    );
});
