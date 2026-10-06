import OpenAI from 'openai';

/**
 * Creates OpenAI client supporting custom baseURL and custom API key.
 * @param {Object} [config]
 * @returns {OpenAI}
 */
export function createOpenAiClient(config = {}) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || 'dummy-key';
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  return new OpenAI({
    apiKey,
    baseURL
  });
}

/**
 * Converts MCP tools (from client.listTools()) to OpenAI Tool Calling format.
 * @param {Array<Object>} mcpTools
 * @returns {Array<Object>} OpenAI format tools
 */
export function convertMcpToolsToOpenAi(mcpTools = []) {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {}
      }
    }
  }));
}

/**
 * Runs the full LLM Agent loop with OpenAI Chat Completions & MCP Tools.
 * 1. Fetches available tools from MCP server.
 * 2. Formats and sends tools + prompt to LLM.
 * 3. Dispatches any requested tool calls to the MCP server.
 * 4. Feeds tool responses back into the LLM conversation.
 * 5. Generates the final human-readable response.
 *
 * @param {Object} options
 * @param {string} options.prompt User request
 * @param {Object} options.mcpClient Connected MCP Client
 * @param {OpenAI} [options.openaiClient] OpenAI client instance
 * @param {string} [options.model] Optional model override
 * @param {Array<Object>} [options.history] Prior conversation history
 * @returns {Promise<Object>}
 */
export async function runLlmAgent({
  prompt,
  mcpClient,
  openaiClient = createOpenAiClient(),
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  history = []
}) {
  // Step 1: Discover available tools from MCP Server
  const { tools: mcpTools } = await mcpClient.listTools();
  const openAiTools = convertMcpToolsToOpenAi(mcpTools);

  // System prompt guiding tool use and formatting
  const systemMessage = {
    role: 'system',
    content:
      'You are a helpful and proactive Todo Assistant powered by the Model Context Protocol (MCP).\n' +
      'You have access to a set of Todo tools: add_todo, list_todos, complete_todo, delete_todo, and get_todo_summary.\n' +
      'Whenever the user wants to add, view, complete, or delete tasks, invoke the appropriate tool.\n' +
      'After executing tools, provide a warm, concise, and clear human-friendly response summarizing the outcome.'
  };

  const messages = [
    systemMessage,
    ...history,
    { role: 'user', content: prompt }
  ];

  // Step 2: First LLM Call with tools enabled
  const firstResponse = await openaiClient.chat.completions.create({
    model,
    messages,
    tools: openAiTools.length > 0 ? openAiTools : undefined,
    tool_choice: openAiTools.length > 0 ? 'auto' : undefined
  });

  const responseMessage = firstResponse.choices[0].message;
  const toolCalls = responseMessage.tool_calls || [];

  // If no tools were called, return direct message
  if (toolCalls.length === 0) {
    return {
      humanMessage: responseMessage.content || '',
      toolCallsExecuted: [],
      messages: [...messages, responseMessage]
    };
  }

  // Step 3: Execute tool calls against MCP Server
  messages.push(responseMessage);
  const toolCallsExecuted = [];

  for (const call of toolCalls) {
    const toolName = call.function.name;
    let toolArgs = {};
    try {
      toolArgs = JSON.parse(call.function.arguments || '{}');
    } catch {
      toolArgs = {};
    }

    // Call MCP Server tool via MCP Client
    const mcpResult = await mcpClient.callTool({
      name: toolName,
      arguments: toolArgs
    });

    const resultText =
      mcpResult.content?.map((c) => c.text).join('\n') || JSON.stringify(mcpResult);

    let parsedResult = null;
    try {
      parsedResult = JSON.parse(resultText);
    } catch {
      parsedResult = resultText;
    }

    toolCallsExecuted.push({
      toolCallId: call.id,
      name: toolName,
      arguments: toolArgs,
      result: parsedResult,
      isError: Boolean(mcpResult.isError)
    });

    // Append tool response to messages
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: resultText
    });
  }

  // Step 4: Second LLM Call to generate final human-friendly summary
  const finalResponse = await openaiClient.chat.completions.create({
    model,
    messages
  });

  const finalHumanMessage = finalResponse.choices[0].message.content || '';

  return {
    humanMessage: finalHumanMessage,
    toolCallsExecuted,
    messages: [...messages, finalResponse.choices[0].message]
  };
}

/**
 * Offline / Simulated Tool Execution Loop for testing & demonstrations
 * without calling external LLM APIs.
 */
export async function executeToolLoopWithMock({ userPrompt, mockToolCall, mcpClient }) {
  const toolResult = await mcpClient.callTool({
    name: mockToolCall.name,
    arguments: mockToolCall.arguments
  });

  const resultText =
    toolResult.content?.map((c) => c.text).join('\n') || JSON.stringify(toolResult);

  let parsed = null;
  try {
    parsed = JSON.parse(resultText);
  } catch {
    parsed = resultText;
  }

  // Deterministic friendly synthesis
  let humanMessage = '';
  if (mockToolCall.name === 'add_todo') {
    humanMessage = `I've created the task "${parsed.todo?.title}" with ${parsed.todo?.priority} priority (ID: ${parsed.todo?.id}).`;
  } else if (mockToolCall.name === 'list_todos') {
    humanMessage = `You currently have ${parsed.count} task(s) on your list.`;
  } else if (mockToolCall.name === 'complete_todo') {
    humanMessage = `Task ${parsed.todo?.id} has been marked as completed!`;
  } else if (mockToolCall.name === 'delete_todo') {
    humanMessage = `Task ${parsed.deleted?.id} has been removed.`;
  } else {
    humanMessage = `Tool ${mockToolCall.name} was executed successfully.`;
  }

  return {
    humanMessage,
    toolCallsExecuted: [
      {
        name: mockToolCall.name,
        arguments: mockToolCall.arguments,
        result: parsed,
        isError: Boolean(toolResult.isError)
      }
    ]
  };
}
