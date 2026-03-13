import log from '@/utils/logger'

import properNouns from '../../prompts/proper-nouns.json'

export const PROPER_NOUNS_PLACEHOLDER = '{{PROPER_NOUNS}}'

export function injectProperNouns(text: string): string {
  if (!text.includes(PROPER_NOUNS_PLACEHOLDER)) return text
  const block = '```json\n' + JSON.stringify(properNouns, null, 2) + '\n```'
  return text.replaceAll(PROPER_NOUNS_PLACEHOLDER, block)
}

export const languageMap: IStringKeyMap = {
  en: 'English',
  'zh-hk': '繁體中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  hi: 'हिन्दी',
  ar: 'العربية',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  nl: 'Nederlands',
  sv: 'Svenska',
  fi: 'Suomi',
  no: 'Norsk',
  da: 'Dansk',
  pl: 'Polski',
  tr: 'Türkçe',
  el: 'Ελληνικά',
  he: 'עברית',
  hu: 'Magyar',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  uk: 'Українська',
  bg: 'Български',
  cs: 'Čeština',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  hr: 'Hrvatski',
  sr: 'Српски',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ur: 'اردو',
}

export const availableAPIs: IStringKeyMap = {
  official: 'official',
  azure: 'azure',
  gemini: 'gemini',
  ollama: 'ollama',
  groq: 'groq',
  openaiCompatible: 'openaiCompatible',
}

// official API 可用的模型
export const availableModels: string[] = [
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5.1-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'o1',
  'o3',
]

// Gemini API 可用的模型
export const availableModelsForGemini: string[] = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'aqa',
]

// Ollama API 可用的模型
export const availableModelsForOllama: string[] = [
  'qwen3:latest',
  'llama4:latest',
  'deepseek-r1:latest',
  'gpt-oss:latest',
  'kimi-k2:1t-cloud',
  'gemini-3-flash-preview:latest',
  'ministral-3:latest',
]

export const availableModelsForOpenAICompatible: string[] = ['Qwen3.5-27B-4bit']

export const availableModelsForGroq: string[] = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-guard-4-12b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-prompt-guard-2-22m',
  'meta-llama/llama-prompt-guard-2-86m',
  'moonshotai/kimi-k2-instruct-0905',
  'qwen/qwen3-32b',
]
export const buildInPrompt = {
  translate: {
    system: (language: string) => `Translate text to ${language}. Output ONLY the translation.

Preserve these proper nouns exactly — do not translate or romanise them:
{{PROPER_NOUNS}}`,
    user: (text: string, language: string) => `${text}`,
  },

  polish: {
    system: (language: string) =>
      `
You are a professional editor specialising in Hong Kong government and civil service writing, specifically for the Electrical and Mechanical Services Department (EMSD).

Rephrase the provided paragraph to improve clarity, readability, and grammatical accuracy while preserving the original meaning and formal register.

Respond in ${language}.

## Style Rules

- Formal Hong Kong civil service English tone
- British English spelling: "digitalisation", "organisation", "utilise", "authorised", "recognised"
- Passive voice is acceptable and preferred for institutional statements (e.g. "was confirmed", "were noted", "has been submitted")
- Sentence length: concise; avoid run-on sentences
- Do not add, infer, or omit any facts, figures, dates, or named individuals

## Proper Noun Preservation List

Preserve the following terms exactly as written — do not rephrase, translate, or expand them:

### Department & Division Names

- EMSD — Electrical and Mechanical Services Department (機電工程署)
- EMSTF — EMSD Task Force
- DTD — Digitalization & Technology Division
- ESB3 — Engineering Services Branch 3
- GPA — Government Property Agency
- DPO — Digital Policy Office
- GovCERT.HK — HK Computer Emergency Response Team Coordination Centre

### Internal Systems & Platforms

- EAMP — EMSD Asset Management Portal
- BIM-AM — Building Information Modelling – Asset Management
- BMS / iBMS — (intelligent) Building Management System
- GWIN — Government Wireless Internet Network
- RDCC — Regional Digital Control Centre
- CIS — Central Internet Services
- SIEM — Security Information and Event Management
- CCeP, CCS, T-con, NCSC — internal systems/sections

### Roles & Post Titles

- AD/3, CE/DT, CE/CS, SE/AI, SE/BIM, SE/DRA, SE/GT, SE/GWIN, SE/INNO, SE/ITD, SE/ITSS1, SE/ITSS2
- SPE/DSS, PSE/GWIN, CSO (E&M), EE, APO, PO — preserve post abbreviations exactly

### Venues

- BIM-AM Center, Skyline Tower, EMSD HQs, Inno Studio

### Standards & Documents

- S17 — HKSAR Government IT Security Policy Manual (S17 references e.g. [S17 11.4.3.])
- CI Manual — Corporate Identity Manual
- DBP — Departmental Business Plan

### Financial Terms

- OPEX — Operating Expenditure
- CAPEX — Capital Expenditure

## Output

Return only the rephrased paragraph. No explanation, no preamble.
    `,
    user: (text: string, language: string) =>
      `Task: Rephrase the following paragraph according to the style rules and proper noun list provided.
    
      Constraints: 
      1. Respond in ${language}.
      2. OUTPUT ONLY the polished text without any commentary.
      
      Text: ${text}`,
  },

  academic: {
    system: (language: string) =>
      `You are a senior academic editor for high-impact journals (e.g., Nature, Science). You specialize in formal, precise, and objective scholarly writing in ${language}.`,
    user: (text: string, language: string) =>
      `Task: Rewrite the following text to meet professional academic standards.
      Requirements:
      - Use formal, objective language and avoid colloquialisms.
      - Ensure logical transitions and precise scientific terminology.
      - Maintain a third-person perspective unless the context requires otherwise.
      - Optimize for clarity and conciseness as per peer-review expectations.
      Constraints:
      1. Respond in ${language}.
      2. OUTPUT ONLY the revised text. No pre-amble or meta-talk.
      
      Text: ${text}`,
  },

  summary: {
    system: (language: string) =>
      `You are an expert document analyst. You excel at distilling complex information into clear, actionable summaries in ${language}.`,
    user: (text: string, language: string) =>
      `Task: Summarize the following text.
      Structure:
      - Capture the core message and primary supporting points.
      - Aim for approximately 100 words (or 3-5 key bullet points).
      - Ensure the summary is self-contained and easy to understand.
      Constraints:
      1. Respond in ${language}.
      2. OUTPUT ONLY the summary.
      
      Text: ${text}`,
  },

  grammar: {
    system: (language: string) =>
      `You are a meticulous proofreader. Your sole focus is linguistic accuracy, including syntax, morphology, and orthography in ${language}.`,
    user: (text: string, language: string) =>
      `Task: Check and correct the grammar of the following text.
      Focus:
      - Fix all spelling and punctuation errors.
      - Correct subject-verb agreement and tense inconsistencies.
      - Ensure proper sentence structure.
      Constraints:
      1. If the text is already perfect, respond exactly with: "No grammatical issues found."
      2. Otherwise, provide ONLY the corrected text without explaining the changes.
      3. Respond in ${language}.
      
      Text: ${text}`,
  },
}

export const getBuiltInPrompt = () => {
  const stored = localStorage.getItem('customBuiltInPrompts')
  if (!stored) {
    return buildInPrompt
  }

  try {
    const customPrompts = JSON.parse(stored)
    const result = { ...buildInPrompt }

    Object.keys(customPrompts).forEach(key => {
      const typedKey = key as keyof typeof buildInPrompt
      if (result[typedKey]) {
        result[typedKey] = {
          system: (language: string) => customPrompts[key].system.replace(/\$\{language\}/g, language),
          user: (text: string, language: string) =>
            customPrompts[key].user.replace(/\$\{text\}/g, text).replace(/\$\{language\}/g, language),
        }
      }
    })

    return result
  } catch (error) {
    log.error('Error loading custom built-in prompts:', error)
    return buildInPrompt
  }
}
