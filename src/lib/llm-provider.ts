/**
 * Pluggable LLM provider abstraction via Vercel AI SDK.
 *
 * Config (env vars):
 *   LLM_PROVIDER  = "anthropic" | "openai" | "google" | "openrouter"  (default: anthropic)
 *   LLM_MODEL     = optional model override
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY
 *
 * Default models (cheap + fast):
 *   anthropic  → claude-haiku-4-5
 *   openai     → gpt-4o-mini
 *   google     → gemini-1.5-flash-latest
 *   openrouter → meta-llama/llama-3.1-8b-instruct:free
 */

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

type SupportedProvider = "anthropic" | "openai" | "google" | "openrouter";

const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash-latest",
  openrouter: "meta-llama/llama-3.1-8b-instruct:free",
};

function getProviderModel(): { provider: SupportedProvider; model: string } {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase() as SupportedProvider;
  const model = process.env.LLM_MODEL ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.anthropic;
  return { provider, model };
}

function buildLanguageModel(provider: SupportedProvider, model: string) {
  switch (provider) {
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
      const anthropic = createAnthropic({ apiKey: key });
      return anthropic(model);
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY is not set");
      const openai = createOpenAI({ apiKey: key });
      return openai(model);
    }
    case "google": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY is not set");
      const google = createGoogleGenerativeAI({ apiKey: key });
      return google(model);
    }
    case "openrouter": {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("OPENROUTER_API_KEY is not set");
      const openrouter = createOpenRouter({ apiKey: key });
      return openrouter.chat(model);
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}

/**
 * Generate a single short text with the configured LLM.
 * Normalises output across providers — always returns a plain string.
 */
export async function generatePhrase(prompt: string): Promise<string> {
  const { provider, model } = getProviderModel();
  const languageModel = buildLanguageModel(provider, model);

  const { text } = await generateText({
    model: languageModel,
    prompt,
    maxTokens: 80,
    temperature: 0.7,
  });

  return text.trim();
}

export function providerInfo(): { provider: string; model: string } {
  const { provider, model } = getProviderModel();
  return { provider, model };
}
