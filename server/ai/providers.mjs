import { AI_MODELS } from '../../shared/ai-options.mjs';
import { AIValidationError } from '../../shared/ai-schema.mjs';
import { createAnthropicProvider } from './anthropic.mjs';
import { createOpenAIProvider } from './provider.mjs';

export function createModelProvider(model, env = process.env, options) {
  const provider = AI_MODELS.find(entry => entry.id === model)?.provider;
  switch (provider) {
    case 'openai': return createOpenAIProvider(env.OPENAI_API_KEY, options);
    case 'anthropic': return createAnthropicProvider(env.ANTHROPIC_API_KEY, options);
    default: throw new AIValidationError('请选择可用的解读模型。');
  }
}
