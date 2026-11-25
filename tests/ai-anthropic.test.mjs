import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnthropicProvider } from '../server/ai/anthropic.mjs';
import { buildProviderPayload } from '../server/ai/prompt.mjs';
import { webCheckFromResponse } from '../shared/ai-web.mjs';

function input({ model = 'claude-sonnet-5-5', effort = 'medium', liveCheck = false } = {}) {
  const card = { sourceCardId: 'major-00', reversed: false, drawOrder: 1, x: 0, z: 0, positionLabel: '',
    sourceSnapshot: { name: 'The Fool', theme: '', interpretation: '开始', urbanImagery: '', reversedInterpretation: null } };
  return buildProviderPayload({ model, effort, maxOutputTokens: 6000, liveCheck, timeZone: 'UTC', createdAt: '2026-11-25T00:00:00Z',
    reading: { question: '公开展览今日开放吗？', spread: { type: 'free', name: '自由摆牌' },
      cards: [card, { ...card, sourceCardId: 'major-01', drawOrder: 2 }] } });
}

const usage = { input_tokens: 25, cache_read_input_tokens: 10, cache_creation_input_tokens: 5, output_tokens: 100 };
function reply(payload, content, stop_reason = 'end_turn') {
  return { type: 'message', role: 'assistant', model: payload.model, usage, content, stop_reason };
}
function fixture(returnBody) {
  const requests = [];
  const provider = createAnthropicProvider('test-only', { fetcher: async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, body });
    return Response.json(url.endsWith('/count_tokens') ? { input_tokens: 40 } : returnBody(body));
  } });
  return { provider, requests };
}

test('both Claude models send each of the three chosen effort levels to count and generation on the official API', async () => {
  for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5']) {
    for (const effort of ['low', 'medium', 'high']) {
      const payload = input({ model, effort });
      const { provider, requests } = fixture(() => reply(payload, [
        { type: 'thinking', thinking: 'private' }, { type: 'text', text: '{"summary":"test"}' },
      ]));
      assert.equal(await provider.count(payload), 40);
      const result = await provider.generate(payload);
      assert.deepEqual(requests.map(({ url }) => url), ['https://api.anthropic.com/v1/messages/count_tokens', 'https://api.anthropic.com/v1/messages']);
      const [count, generate] = requests;
      const { max_tokens, service_tier, ...counted } = generate.body;
      assert.deepEqual(count.body, counted);
      assert.equal(max_tokens, payload.max_output_tokens);
      assert.equal(service_tier, 'standard_only');
      assert.equal(generate.init.redirect, 'error');
      assert.equal(generate.init.headers['anthropic-version'], '2023-06-01');
      assert.equal(generate.init.headers['x-api-key'], 'test-only');
      assert.equal(generate.init.headers.Authorization, undefined);
      assert.equal(counted.model, model);
      assert.equal(counted.output_config.effort, effort);
      assert.deepEqual(counted.thinking, { type: 'adaptive' });
      assert.equal(counted.system, payload.instructions);
      assert.equal(counted.messages[0].content, payload.input);
      assert.equal(counted.tools, undefined);
      const cards = counted.output_config.format.schema.properties.cards;
      assert.equal(cards.minItems, 1);
      assert.equal(cards.maxItems, undefined);
      assert.equal(payload.text.format.schema.properties.cards.maxItems, 2);
      assert.deepEqual(result.output[0].content, [{ type: 'output_text', text: '{"summary":"test"}' }]);
      assert.deepEqual(result.usage, { input_tokens: 40, output_tokens: 100, total_tokens: 140,
        input_tokens_details: { cached_tokens: 10, cache_write_tokens: 5 } });
    }
  }
});

const search = { type: 'server_tool_use', name: 'web_search', id: 'search-one', input: { query: 'public exhibition hours' } };
const source = { type: 'web_search_result', url: 'https://example.org/hours', title: 'Opening hours', encrypted_content: 'private' };
const found = { type: 'web_search_tool_result', tool_use_id: search.id, content: [source] };
const submitted = { type: 'tool_use', name: 'submit_interpretation', input: { summary: '用牌义理解问题。' } };

test('a checked Claude answer uses a completed native search followed by one strict structured answer', async () => {
  const payload = input({ liveCheck: true });
  const { provider, requests } = fixture(() => ({ ...reply(payload, [
    { type: 'text', text: '检索中。', citations: [{ type: 'web_search_result_location', url: 'https://unverified.example/' }] },
    search, found, submitted,
  ], 'tool_use'), usage: { ...usage, server_tool_use: { web_search_requests: 1 } } }));
  await provider.count(payload);
  const result = await provider.generate(payload);
  assert.equal(requests.length, 2);
  const body = requests[1].body;
  assert.deepEqual(body.tools[0], { type: 'web_search_20250305', name: 'web_search', max_uses: 3 });
  assert.equal(body.tools[1].strict, true);
  assert.equal(body.tools[1].input_schema.properties.factChecks.items.properties.sourceUrls.maxItems, undefined);
  assert.deepEqual(body.tool_choice, { type: 'auto', disable_parallel_tool_use: true });
  assert.deepEqual(body.output_config, { effort: 'medium' });
  assert.match(body.system, /原问题中实际提出/);
  assert.equal(result.status, 'completed');
  assert.equal(result.usage.server_tool_use.web_search_requests, 1);
  assert.deepEqual(webCheckFromResponse(result, 'test'), { status: 'searched', checkedAt: 'test', searchCalls: 1,
    sources: [{ url: source.url, title: source.title }] });
  assert.deepEqual(result.output.at(-1).content, [{ type: 'output_text', text: JSON.stringify(submitted.input) }]);
});

test('tool prose, pending calls and tool errors never prove a Claude live check; a successful empty search does', async () => {
  const payload = input({ liveCheck: true });
  for (const [blocks, expected] of [
    [[{ type: 'text', text: '已搜索网页。' }, submitted], 'incomplete'],
    [[search, submitted], 'incomplete'],
    [[search, { ...found, content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } }, submitted], 'incomplete'],
    [[search, { ...found, content: [] }, submitted], 'searched'],
  ]) {
    const { provider, requests } = fixture(() => reply(payload, blocks, 'tool_use'));
    const result = await provider.generate(payload);
    assert.equal(webCheckFromResponse(result, 'test').status, expected);
    assert.equal(requests.length, 1);
  }
  for (const blocks of [[found, submitted], [search, { ...found, tool_use_id: 'orphan' }, submitted],
    [search, found, found, submitted], [submitted, search, found], [search, { ...found, content: [{}] }, submitted]]) {
    const { provider } = fixture(() => reply(payload, blocks, 'tool_use'));
    await assert.rejects(provider.generate(payload), { kind: 'invalid_response' });
  }
});

test('a paused, truncated, refused or unstructured Claude response is never continued automatically', async () => {
  const payload = input({ liveCheck: true });
  for (const stop of ['pause_turn', 'max_tokens', 'end_turn', 'refusal']) {
    const { provider, requests } = fixture(() => reply(payload, [search, found, { type: 'text', text: 'no structured answer' }], stop));
    const result = await provider.generate(payload);
    if (stop === 'refusal') assert.deepEqual(result.output.at(-1).content, [{ type: 'refusal' }]);
    else assert.equal(result.status, 'incomplete');
    assert.equal(requests.length, 1);
  }
  assert.throws(() => createAnthropicProvider(' '), { kind: 'not_configured' });
});
