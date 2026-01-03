/**
 * Tests for DeepSeek chat completions.
 *
 * The tests call /api/backends/chat-completions/generate and
 * check if the request is proxied correctly to a DeepSeek API call.
 */
import {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
} from "@jest/globals";
import { MockServer } from "../../util/mock-server.js";
import { TestServer } from "../../util/test-server.js";
import {
    createRequestBody,
    makeGenerateRequest,
} from "../../util/generate-request-builder.js";
import { CHAT_COMPLETION_SOURCES } from "../../../src/constants.js";

describe("DeepSeek /generate endpoint", () => {
    // Mock server to capture chat completion API calls
    const mockServer = new MockServer();

    // Test server to route .../generate
    const testServer = new TestServer();

    function createDeepSeekRequestBody(overrides) {
        return createRequestBody({
            chat_completion_source: CHAT_COMPLETION_SOURCES.DEEPSEEK,
            model: "deepseek-chat",
            reverse_proxy: mockServer.getBaseURL(),
            ...overrides,
        });
    }

    beforeAll(async () => {
        await mockServer.start();
        await testServer.start();
    });

    beforeEach(() => {
        mockServer.clearLastRequest();
    });

    afterAll(async () => {
        await mockServer.stop();
        await testServer.stop();
    });

    test("should send request successfully", async () => {
        const requestBody = createDeepSeekRequestBody();
        const { statusCode, responseBody } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);
        expect(responseBody).toBeDefined();
        expect(responseBody.choices).toBeDefined();
        expect(Array.isArray(responseBody.choices)).toBe(true);
    });

    test("should handle API error response", async () => {
        const requestBody = createDeepSeekRequestBody({
            reverse_proxy: `${mockServer.getBaseURL()}/nonexistent`,
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(500);
    });

    test("should convert logprobs to top_logprobs when set", async () => {
        const requestBody = createDeepSeekRequestBody({ logprobs: 5 });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.top_logprobs).toBe(5);
        expect(received.logprobs).toBe(true);
    });

    test("should remove empty required arrays from tool parameters", async () => {
        const requestBody = createDeepSeekRequestBody({
            tools: [
                {
                    function: {
                        name: "test_tool",
                        parameters: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                },
            ],
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.tools[0].function.parameters.required).toBeUndefined();
    });

    test("should keep non-empty required arrays in tool parameters", async () => {
        const requestBody = createDeepSeekRequestBody({
            tools: [
                {
                    function: {
                        name: "test_tool",
                        parameters: {
                            type: "object",
                            properties: {},
                            required: ["param1"],
                        },
                    },
                },
            ],
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.tools[0].function.parameters.required).toEqual([
            "param1",
        ]);
    });

    test("should merge consecutive user messages", async () => {
        const requestBody = createDeepSeekRequestBody({
            messages: [
                { role: "user", content: "Hello" },
                { role: "user", content: "World" },
            ],
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.messages).toHaveLength(1);
        expect(received.messages[0].content).toBe("Hello\n\nWorld");
    });

    test("should add JSON schema message when json_schema is provided", async () => {
        const requestBody = createDeepSeekRequestBody({
            json_schema: { value: { type: "object" } },
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.messages).toHaveLength(1);
        expect(received.messages[0].content).toContain("JSON schema");
        expect(received.response_format).toEqual({ type: "json_object" });
    });

    test("should preserve reasoning and tool calls across multiple turns", async () => {
        const requestBody = createDeepSeekRequestBody({
            model: "deepseek-reasoner",
            messages: [
                { role: "user", content: "What is the weather in Paris and Berlin?" },
                {
                    role: "assistant",
                    content: null,
                    reasoning_content: "The user wants weather for two cities. Checking Paris first.",
                    tool_calls: [
                        {
                            id: "call_paris",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: '{"city": "Paris"}',
                            },
                        },
                    ],
                },
                {
                    role: "tool",
                    tool_call_id: "call_paris",
                    content: "The weather in Paris is 15°C with light rain.",
                },
                {
                    role: "assistant",
                    content: null,
                    reasoning_content: "Now checking the weather in Berlin.",
                    tool_calls: [
                        {
                            id: "call_berlin",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: '{"city": "Berlin"}',
                            },
                        },
                    ],
                },
                {
                    role: "tool",
                    tool_call_id: "call_berlin",
                    content: "The weather in Berlin is 20°C and cloudy.",
                },
                {
                    role: "assistant",
                    content: null,
                    reasoning_content: "Both cities are checked, no further tool calls needed.",
                },
                { role: "user", content: "Now what is the weather in Tokyo?" },
                {
                    role: "assistant",
                    content: null,
                    reasoning_content: "A new city was requested, checking Tokyo next.",
                    tool_calls: [
                        {
                            id: "call_tokyo",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: '{"city": "Tokyo"}',
                            },
                        },
                    ],
                },
                {
                    role: "tool",
                    tool_call_id: "call_tokyo",
                    content: "The weather in Tokyo is 25°C and sunny.",
                },
                {
                    role: "assistant",
                    content: null,
                    reasoning_content: "The result depends on the time zone, checking that as well.",
                    tool_calls: [
                        {
                            id: "call_tokyo_tz",
                            type: "function",
                            function: {
                                name: "get_time_zone",
                                arguments: '{"city": "Tokyo"}',
                            },
                        },
                    ],
                },
                {
                    role: "tool",
                    tool_call_id: "call_tokyo_tz",
                    content: "The time zone in Tokyo is UTC+9.",
                },
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "get_weather",
                        description: "Get the current weather for a city",
                        parameters: {
                            type: "object",
                            properties: {
                                city: { type: "string" },
                            },
                            required: ["city"],
                        },
                    },
                },
                {
                    type: "function",
                    function: {
                        name: "get_time_zone",
                        description: "Get the time zone for a city",
                        parameters: {
                            type: "object",
                            properties: {
                                city: { type: "string" },
                            },
                            required: ["city"],
                        },
                    },
                },
            ],
            tool_choice: "auto",
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();

        // All eleven messages survive post-processing with their roles intact
        expect(received.messages).toHaveLength(11);
        expect(received.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "tool",
            "assistant",
            "tool",
            "assistant",
            "user",
            "assistant",
            "tool",
            "assistant",
            "tool",
        ]);

        const [
            firstUser,
            firstToolCall,
            firstToolResult,
            secondToolCall,
            secondToolResult,
            reasoningOnly,
            secondUser,
            thirdToolCall,
            thirdToolResult,
            fourthToolCall,
            fourthToolResult,
        ] = received.messages;

        expect(firstUser.content).toBe("What is the weather in Paris and Berlin?");
        expect(secondUser.content).toBe("Now what is the weather in Tokyo?");

        // Tool call results are forwarded untouched, one per tool call
        expect(firstToolResult).toEqual({
            role: "tool",
            tool_call_id: "call_paris",
            content: "The weather in Paris is 15°C with light rain.",
        });
        expect(secondToolResult).toEqual({
            role: "tool",
            tool_call_id: "call_berlin",
            content: "The weather in Berlin is 20°C and cloudy.",
        });
        expect(thirdToolResult).toEqual({
            role: "tool",
            tool_call_id: "call_tokyo",
            content: "The weather in Tokyo is 25°C and sunny.",
        });
        expect(fourthToolResult).toEqual({
            role: "tool",
            tool_call_id: "call_tokyo_tz",
            content: "The time zone in Tokyo is UTC+9.",
        });

        // Consecutive assistant tool calls are kept as separate messages,
        // each retaining its own reasoning and tool call
        expect(firstToolCall.content).toBe("");
        expect(firstToolCall.reasoning_content).toBe(
            "The user wants weather for two cities. Checking Paris first."
        );
        expect(firstToolCall.tool_calls).toEqual([
            {
                id: "call_paris",
                type: "function",
                function: {
                    name: "get_weather",
                    arguments: '{"city": "Paris"}',
                },
            },
        ]);
        expect(secondToolCall.reasoning_content).toBe(
            "Now checking the weather in Berlin."
        );
        expect(secondToolCall.tool_calls).toEqual([
            {
                id: "call_berlin",
                type: "function",
                function: {
                    name: "get_weather",
                    arguments: '{"city": "Berlin"}',
                },
            },
        ]);

        // The reasoning-only assistant message keeps its reasoning
        // and does not get tool calls injected
        expect(reasoningOnly.content).toBe("");
        expect(reasoningOnly.reasoning_content).toBe(
            "Both cities are checked, no further tool calls needed."
        );
        expect(reasoningOnly.tool_calls).toBeUndefined();

        // The second turn's tool calls are preserved as well
        expect(thirdToolCall.reasoning_content).toBe(
            "A new city was requested, checking Tokyo next."
        );
        expect(thirdToolCall.tool_calls).toEqual([
            {
                id: "call_tokyo",
                type: "function",
                function: {
                    name: "get_weather",
                    arguments: '{"city": "Tokyo"}',
                },
            },
        ]);
        expect(fourthToolCall.reasoning_content).toBe(
            "The result depends on the time zone, checking that as well."
        );
        expect(fourthToolCall.tool_calls).toEqual([
            {
                id: "call_tokyo_tz",
                type: "function",
                function: {
                    name: "get_time_zone",
                    arguments: '{"city": "Tokyo"}',
                },
            },
        ]);

        // No assistant prefix is added to the trailing message when tools are present
        expect(fourthToolCall.prefix).toBeUndefined();

        // Tools and tool choice are forwarded to the API
        expect(received.tools).toHaveLength(2);
        expect(received.tools.map((t) => t.function.name)).toEqual([
            "get_weather",
            "get_time_zone",
        ]);
        expect(received.tool_choice).toBe("auto");
    });

    test("should add reasoning_content to past tool calls when model contains -reasoner", async () => {
        const requestBody = createDeepSeekRequestBody({
            model: "deepseek-reasoner",
            messages: [
                {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                        {
                            id: "call_1",
                            type: "function",
                            function: { name: "test", arguments: "{}" },
                        },
                    ],
                },
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Let me call the tool" },
                {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                        {
                            id: "call_2",
                            type: "function",
                            function: { name: "test", arguments: "{}" },
                        },
                    ],
                },
            ],
        });
        const { statusCode } = await makeGenerateRequest(
            testServer.getBaseUrl(),
            requestBody
        );

        expect(statusCode).toBe(200);

        const received = mockServer.getLastRequest();
        expect(received.messages[0].reasoning_content).toBe(""); // tool call
        expect(received.messages[1].reasoning_content).toBeUndefined(); // user
        expect(received.messages[2].reasoning_content).toBeUndefined(); // assistant
        expect(received.messages[3].reasoning_content).toBe(""); // tool call
    });
});
