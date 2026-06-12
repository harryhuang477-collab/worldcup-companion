/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure API keys never leak into client bundle
  serverRuntimeConfig: {
    FOOTBALL_API_KEY: process.env.FOOTBALL_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_MODEL: process.env.LLM_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
  publicRuntimeConfig: {},
};

module.exports = nextConfig;
