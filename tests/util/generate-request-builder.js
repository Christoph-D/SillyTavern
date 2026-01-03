/**
 * Creates a request body for chat completions.
 * @param {object} overrides - Optional overrides for default values.
 * @returns {object} Request body object.
 */
export function createRequestBody(overrides = {}) {
    return {
        chat_completion_source: null, // Tests need to set this
        model: "some-model",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 1.0,
        max_tokens: 1000,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        top_p: 1,
        stop: null,
        seed: null,
        reverse_proxy: null, // Tests need to set this
        proxy_password: "test-api-key",
        logprobs: 0,
        tools: null,
        tool_choice: null,
        json_schema: null,
        ...overrides,
    };
}

/**
 * Makes a POST request to the chat completion /generate endpoint.
 * @param {string} baseUrl - Base URL of the test server.
 * @param {object} requestBody - Request body to send.
 * @returns {Promise<{statusCode: number, responseBody: any}>}
 */
export async function makeGenerateRequest(baseUrl, requestBody) {
    const response = await fetch(
        `${baseUrl}/api/backends/chat-completions/generate`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        }
    );
    const statusCode = response.status;
    const responseBody = await response.json().catch(() => null);
    return { statusCode, responseBody };
}
