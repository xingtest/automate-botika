/**
 * Config Resolver
 * Standard helper for reading node configuration values
 */

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function resolveConfigValue(config, key, envVar, defaultValue = undefined) {
  if (config && hasValue(config[key])) {
    return config[key];
  }
  if (envVar && hasValue(process.env[envVar])) {
    return process.env[envVar];
  }
  return defaultValue;
}

function resolveApiKey(config, provider) {
  if (!config) return null;

  const normalizedProvider = String(provider || '').toLowerCase();
  const envMap = {
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openai: 'OPENAI_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
    llama: 'LLAMA_API_KEY'
  };

  if (hasValue(config.apiKey)) return config.apiKey;
  if (hasValue(config.api_key)) return config.api_key;
  if (hasValue(config.apiKeyGemini)) return config.apiKeyGemini;
  if (hasValue(config.apiKeyGroq)) return config.apiKeyGroq;
  if (hasValue(config.apiKeyOpenAI)) return config.apiKeyOpenAI;

  const envVar = envMap[normalizedProvider];
  if (envVar && hasValue(process.env[envVar])) {
    return process.env[envVar];
  }

  return null;
}

module.exports = {
  hasValue,
  resolveConfigValue,
  resolveApiKey
};
