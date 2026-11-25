import { AI_MAX_WEB_TOOL_CALLS } from '../../shared/ai-web.mjs';
import { AIProviderError, providerRequest } from './provider.mjs';

const ANSWER_TOOL = 'submit_interpretation';

// Both Anthropic output modes accept only minItems 0 or 1 and no maxItems.
// The shared answer validator still enforces every original bound after generation.
function anthropicSchema(schema) {
  const copy = structuredClone(schema);
  function adjust(node) {
    if (node.type === 'array') {
      if (node.minItems > 1) node.minItems = 1;
      delete node.maxItems;
      adjust(node.items);
    }
    if (node.properties) Object.values(node.properties).forEach(adjust);
  }
  adjust(copy);
  return copy;
}

function messageInputs(payload) {
  const schema = anthropicSchema(payload.text.format.schema);
  const body = {
    model: payload.model,
    messages: [{ role: 'user', content: payload.input }],
    system: payload.instructions,
    thinking: { type: 'adaptive' },
    output_config: { effort: payload.reasoning.effort },
  };
  if (payload.tools) {
    // Native web citations conflict with the JSON output format. A final strict
    // tool carries the answer in the same HTTP request, after the server search.
    body.tools = [
      { type: 'web_search_20250305', name: 'web_search', max_uses: AI_MAX_WEB_TOOL_CALLS },
      { name: ANSWER_TOOL, description: '在取得 web_search 结果之后，用这项工具提交本次完整解读。', strict: true, input_schema: schema },
    ];
    body.system += '\n\n先单独调用 web_search 并读取结果。完成检索后，单独调用 submit_interpretation 提交完整解读。';
    body.tool_choice = { type: 'auto', disable_parallel_tool_use: true };
  } else {
    body.output_config.format = { type: 'json_schema', schema };
  }
  return body;
}

function normalizedUsage(usage) {
  if (!usage) return undefined;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  if (![usage.input_tokens, usage.output_tokens, read, write].every(n => Number.isSafeInteger(n) && n >= 0)) {
    throw new AIProviderError('invalid_response');
  }
  // Anthropic reports the three categories of input tokens separately.
  const input = usage.input_tokens + read + write;
  return { input_tokens: input, output_tokens: usage.output_tokens, total_tokens: input + usage.output_tokens,
    input_tokens_details: { cached_tokens: usage.cache_read_input_tokens ?? undefined,
      cache_write_tokens: usage.cache_creation_input_tokens ?? undefined },
    ...(usage.server_tool_use ? { server_tool_use: { web_search_requests: usage.server_tool_use.web_search_requests } } : {}),
  };
}

function normalizeMessage(message, liveCheck) {
  if (message?.type !== 'message' || message.role !== 'assistant' || !Array.isArray(message.content)) throw new AIProviderError('invalid_response');
  const searches = new Map();
  const output = [];
  const answerParts = [];
  let submitted = false;
  for (const block of message.content) {
    if (block?.type === 'server_tool_use') {
      if (submitted || block.name !== 'web_search' || typeof block.id !== 'string' || !block.id || searches.has(block.id)) {
        throw new AIProviderError('invalid_response');
      }
      const call = { type: 'web_search_call', status: 'in_progress', action: { type: 'search', sources: [] } };
      searches.set(block.id, call);
      output.push(call);
    } else if (block?.type === 'web_search_tool_result') {
      const call = searches.get(block.tool_use_id);
      if (!call || call.status !== 'in_progress' || submitted) throw new AIProviderError('invalid_response');
      if (Array.isArray(block.content) && block.content.every(item => item?.type === 'web_search_result')) {
        call.status = 'completed';
        call.action.sources = block.content.map(({ title, url }) => ({ title, url }));
      } else if (block.content?.type === 'web_search_tool_result_error') {
        call.status = 'failed';
      } else throw new AIProviderError('invalid_response');
    } else if (block?.type === 'tool_use') {
      if (!liveCheck || submitted || block.name !== ANSWER_TOOL) throw new AIProviderError('invalid_response');
      // A token-limited tool block may have partial input. Only a terminal
      // submission is an answer; leave the truncated turn incomplete.
      if (message.stop_reason !== 'tool_use') continue;
      if (!block.input || typeof block.input !== 'object' || Array.isArray(block.input)) throw new AIProviderError('invalid_response');
      submitted = true;
      answerParts.push({ type: 'output_text', text: JSON.stringify(block.input) });
    } else if (!liveCheck && block?.type === 'text') {
      answerParts.push({ type: 'output_text', text: block.text });
    }
  }
  let status;
  switch (message.stop_reason) {
    case 'end_turn': status = liveCheck ? 'incomplete' : 'completed'; break;
    case 'tool_use': {
      const pendingSearch = output.some(call => call.status === 'in_progress');
      status = submitted && !pendingSearch ? 'completed' : 'incomplete';
      break;
    }
    case 'refusal':
      status = 'completed';
      answerParts.push({ type: 'refusal' });
      break;
    case 'pause_turn':
    case 'max_tokens':
    case 'model_context_window_exceeded': status = 'incomplete'; break;
    default: status = 'unknown';
  }
  output.push({ type: 'message', content: answerParts });
  return { model: message.model, status, output, usage: normalizedUsage(message.usage) };
}

/** Token counting and at most one explicitly initiated Messages generation. */
export function createAnthropicProvider(apiKey, { fetcher = fetch, timeoutMs = 115000 } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new AIProviderError('not_configured');
  const request = providerRequest('https://api.anthropic.com/v1', {
    'x-api-key': apiKey.trim(), 'anthropic-version': '2023-06-01',
  }, fetcher, timeoutMs);
  return {
    async count(payload) {
      const data = await request('/messages/count_tokens', messageInputs(payload), Math.min(timeoutMs, 25000));
      if (!Number.isSafeInteger(data?.input_tokens) || data.input_tokens < 1) throw new AIProviderError('invalid_response');
      return data.input_tokens;
    },
    async generate(payload) {
      const message = await request('/messages', { ...messageInputs(payload), max_tokens: payload.max_output_tokens, service_tier: 'standard_only' });
      return normalizeMessage(message, Boolean(payload.tools));
    },
  };
}
