import { AIMessage, HumanMessage, type Message, SystemMessage } from '@langchain/core/messages'
import { useStorage } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getAgentResponse, getChatResponse } from '@/api/union'
import { localStorageKey } from '@/utils/enum'
import { createGeneralTools, type GeneralToolName } from '@/utils/generalTools'
import { message as messageUtil } from '@/utils/message'
import type useSettingForm from '@/utils/settingForm'
import { createWordTools, type WordToolName } from '@/utils/wordTools'

type SettingForm = ReturnType<typeof useSettingForm>

export interface UseChatOptions {
  settingForm: SettingForm
  mode: Ref<'ask' | 'agent'>
  customSystemPrompt: Ref<string>
  onScrollToBottom: () => void
}

const allWordToolNames: WordToolName[] = [
  'getSelectedText',
  'getDocumentContent',
  'insertText',
  'replaceSelectedText',
  'appendText',
  'insertParagraph',
  'formatText',
  'searchAndReplace',
  'getDocumentProperties',
  'insertTable',
  'insertList',
  'deleteText',
  'clearFormatting',
  'setFontName',
  'insertPageBreak',
  'getRangeInfo',
  'selectText',
  'insertImage',
  'getTableInfo',
  'insertBookmark',
  'goToBookmark',
  'insertContentControl',
  'findText',
  'selectSpecificText',
  'clearHighlights',
  'insertNewPage',
  'getDocumentStructure',
  'setParagraphFormat',
  'setListFormat',
  'copyRangeOoxml',
  'pasteOoxml',
  'insertFormattedText',
]

const allGeneralToolNames: GeneralToolName[] = ['fetchWebContent', 'searchWeb', 'getCurrentDate', 'calculateMath']

function loadEnabledWordTools(): WordToolName[] {
  const stored = localStorage.getItem('enabledWordTools')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return parsed.filter((name: string) => allWordToolNames.includes(name as WordToolName))
    } catch {
      return [...allWordToolNames]
    }
  }
  return [...allWordToolNames]
}

function loadEnabledGeneralTools(): GeneralToolName[] {
  const stored = localStorage.getItem('enabledGeneralTools')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return parsed.filter((name: string) => allGeneralToolNames.includes(name as GeneralToolName))
    } catch {
      return [...allGeneralToolNames]
    }
  }
  return [...allGeneralToolNames]
}

const agentPrompt = (lang: string) =>
  `
# Role
You are a highly skilled Microsoft Word Expert Agent. Your goal is to assist users in creating, editing, and formatting documents with professional precision.

# Capabilities
- You can interact with the document directly using provided tools (reading text, applying styles, inserting content, etc.).
- You understand document structure, typography, and professional writing standards.

# Guidelines
1. **Tool First**: If a request requires document modification or inspection or web search and fetch, prioritize using the available tools.
2. **Accuracy**: Ensure formatting and content changes are precise and follow the user's intent.
3. **Conciseness**: Provide brief, helpful explanations of your actions.
4. **Language**: You must communicate entirely in ${lang}.
5. **Efficiency**: When multiple independent tool actions are needed (e.g., formatting several paragraphs, inserting multiple items), call all of them in a single response rather than one at a time. Only sequence tool calls when one depends on another's result.

# Safety
Do not perform destructive actions (like clearing the whole document) unless explicitly instructed.
`.trim()

const standardPrompt = (lang: string) =>
  `You are a helpful Microsoft Word specialist. Help users with drafting, brainstorming, and Word-related questions. Reply in ${lang}.`

export function flattenContentArray(content: any[]): string {
  return content
    .map((part: any) => {
      if (typeof part === 'string') return part
      if (part?.text && typeof part.text === 'string') return part.text
      if (part?.data && typeof part.data === 'string') return part.data
      return ''
    })
    .join('')
}

export function getMessageText(msg: Message): string {
  const content: any = (msg as any).content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return flattenContentArray(content)
  return ''
}

export function useChat(options: UseChatOptions) {
  const { settingForm, mode, customSystemPrompt, onScrollToBottom } = options
  const { t } = useI18n()

  const history = ref<Message[]>([])
  const loading = ref(false)
  const abortController = ref<AbortController | null>(null)
  const threadId = useStorage(localStorageKey.threadId, uuidv4())
  const currentCheckpointId = ref<string>('')
  const errorIssue = ref<boolean | string | null>(false)
  const toolCallLog = ref<string[]>([])

  const enabledWordTools = ref<WordToolName[]>(loadEnabledWordTools())
  const enabledGeneralTools = ref<GeneralToolName[]>(loadEnabledGeneralTools())

  function getActiveTools() {
    const wordTools = createWordTools(enabledWordTools.value)
    const generalTools = createGeneralTools(enabledGeneralTools.value)
    return [...generalTools, ...wordTools]
  }

  function stopGeneration() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    loading.value = false
  }

  async function processChat(userMessage: HumanMessage, systemMessage?: string): Promise<void> {
    const settings = settingForm.value
    const { replyLanguage: lang, api: provider } = settings

    const isAgentMode = mode.value === 'agent'

    const finalSystemMessage =
      customSystemPrompt.value || systemMessage || (isAgentMode ? agentPrompt(lang) : standardPrompt(lang))

    const defaultSystemMessage = new SystemMessage(finalSystemMessage)

    history.value.push(userMessage)

    const finalMessages = [defaultSystemMessage, ...history.value]

    const providerConfigs: Record<string, any> = {
      official: {
        provider: 'official',
        config: {
          apiKey: settings.officialAPIKey,
          baseURL: settings.officialBasePath,
          dangerouslyAllowBrowser: true,
        },
        maxTokens: settings.officialMaxTokens,
        temperature: settings.officialTemperature,
        model: settings.officialModelSelect,
      },
      groq: {
        provider: 'groq',
        groqAPIKey: settings.groqAPIKey,
        groqModel: settings.groqModelSelect,
        maxTokens: settings.groqMaxTokens,
        temperature: settings.groqTemperature,
      },
      azure: {
        provider: 'azure',
        azureAPIKey: settings.azureAPIKey,
        azureAPIEndpoint: settings.azureAPIEndpoint,
        azureDeploymentName: settings.azureDeploymentName,
        azureAPIVersion: settings.azureAPIVersion,
        maxTokens: settings.azureMaxTokens,
        temperature: settings.azureTemperature,
      },
      gemini: {
        provider: 'gemini',
        geminiAPIKey: settings.geminiAPIKey,
        maxTokens: settings.geminiMaxTokens,
        temperature: settings.geminiTemperature,
        geminiModel: settings.geminiModelSelect,
      },
      ollama: {
        provider: 'ollama',
        ollamaEndpoint: settings.ollamaEndpoint,
        ollamaModel: settings.ollamaModelSelect,
        temperature: settings.ollamaTemperature,
      },
      openaiCompatible: {
        provider: 'openaiCompatible',
        openaiCompatibleAPIKey: settings.openaiCompatibleAPIKey,
        openaiCompatibleBasePath: settings.openaiCompatibleBasePath,
        model: settings.openaiCompatibleModelSelect,
        maxTokens: settings.openaiCompatibleMaxTokens,
        temperature: settings.openaiCompatibleTemperature,
        streaming: settings.openaiCompatibleStreaming === 'on',
      },
    }

    const currentConfig = providerConfigs[provider]
    if (!currentConfig) {
      messageUtil.error(t('notSupportedProvider'))
      return
    }

    history.value.push(new AIMessage(''))

    console.log(finalMessages)

    if (isAgentMode) {
      const tools = getActiveTools()
      toolCallLog.value = []

      await getAgentResponse({
        ...currentConfig,
        recursionLimit: settings.agentMaxIterations,
        messages: finalMessages,
        tools,
        errorIssue,
        loading,
        abortSignal: abortController.value?.signal,
        threadId: threadId.value,
        checkpointId: currentCheckpointId.value,
        onStream: (text: string) => {
          const lastIndex = history.value.length - 1
          if (toolCallLog.value.length > 0) {
            const toolSection =
              '<tool_calls>' + toolCallLog.value.join('\n') + '</tool_calls>'
            history.value[lastIndex] = new AIMessage(toolSection + '\n\n' + text)
          } else {
            history.value[lastIndex] = new AIMessage(text)
          }
          onScrollToBottom()
        },
        onToolCall: (toolName: string, _args: any) => {
          const lastIndex = history.value.length - 1
          const currentContent = getMessageText(history.value[lastIndex])
          history.value[lastIndex] = new AIMessage(currentContent + `\n\n🔧 Calling tool: ${toolName}...`)
          onScrollToBottom()
        },
        onToolResult: (toolName: string, _result: string) => {
          toolCallLog.value.push(toolName)
          const lastIndex = history.value.length - 1
          const currentContent = getMessageText(history.value[lastIndex])
          const updatedContent = currentContent.replace(
            `🔧 Calling tool: ${toolName}...`,
            `✅ Tool ${toolName} completed`,
          )
          history.value[lastIndex] = new AIMessage(updatedContent)
          onScrollToBottom()
        },
      })
    } else {
      await getChatResponse({
        ...currentConfig,
        messages: finalMessages,
        errorIssue,
        loading,
        abortSignal: abortController.value?.signal,
        threadId: threadId.value,
        onStream: (text: string) => {
          const lastIndex = history.value.length - 1
          history.value[lastIndex] = new AIMessage(text)
          onScrollToBottom()
        },
      })
    }

    if (errorIssue.value) {
      const errorMsg = typeof errorIssue.value === 'string'
        ? t(errorIssue.value)
        : t('somethingWentWrong')
      messageUtil.error(errorMsg)
      const lastIndex = history.value.length - 1
      const lastContent = getMessageText(history.value[lastIndex])
      history.value[lastIndex] = new AIMessage(
        (lastContent ? lastContent + '\n\n' : '') + `⚠️ ${errorMsg}`
      )
      errorIssue.value = null
      return
    }

    onScrollToBottom()
  }

  return {
    history,
    loading,
    abortController,
    threadId,
    currentCheckpointId,
    errorIssue,
    enabledWordTools,
    enabledGeneralTools,
    processChat,
    stopGeneration,
    getMessageText,
  }
}
