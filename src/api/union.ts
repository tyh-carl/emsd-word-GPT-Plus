import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { BaseMessage, SystemMessage } from '@langchain/core/messages'
import { ChatResult } from '@langchain/core/outputs'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatGroq } from '@langchain/groq'
// import { MemorySaver } from '@langchain/langgraph'
import { ChatOllama } from '@langchain/ollama'
import { AzureChatOpenAI, ChatOpenAI } from '@langchain/openai'
import { createAgent } from 'langchain'

import { IndexedDBSaver } from '@/api/checkpoints'
import { AgentLogger } from '@/utils/agentLogger'
import log from '@/utils/logger'

import {
  AgentOptions,
  AzureOptions,
  GeminiOptions,
  GroqOptions,
  OllamaOptions,
  OpenAICompatibleOptions,
  OpenAIOptions,
  ProviderOptions,
} from './types'

/**
 * ChatOpenAI variant that normalizes messages before every LLM call.
 * Merges all system messages into one and ensures it is at position 0.
 * Required for models (e.g. Qwen via mlx_vlm) whose chat template enforces
 * "System message must be at the beginning."
 */
class SystemFirstChatOpenAI extends ChatOpenAI {
  override async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const systemMsgs = messages.filter(m => m._getType() === 'system')
    const otherMsgs = messages.filter(m => m._getType() !== 'system')

    let normalized: BaseMessage[]
    if (systemMsgs.length <= 1 && (messages.length === 0 || messages[0]._getType() === 'system')) {
      normalized = messages // already valid — skip
    } else {
      const merged = systemMsgs.map(m => (typeof m.content === 'string' ? m.content : '')).join('\n\n')
      normalized = merged ? [new SystemMessage(merged), ...otherMsgs] : otherMsgs
    }

    return super._generate(normalized, options, runManager)
  }
}

const ModelCreators: Record<string, (opts: any) => BaseChatModel> = {
  official: (opts: OpenAIOptions) => {
    const modelName = opts.model || 'gpt-5'
    return new ChatOpenAI({
      modelName,
      configuration: {
        apiKey: opts.config.apiKey,
        baseURL: opts.config.baseURL || 'https://api.openai.com/v1',
      },
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 800,
    })
  },

  ollama: (opts: OllamaOptions) => {
    return new ChatOllama({
      model: opts.ollamaModel,
      baseUrl: opts.ollamaEndpoint?.replace(/\/$/, '') || 'http://localhost:11434',
      temperature: opts.temperature,
    })
  },

  groq: (opts: GroqOptions) => {
    return new ChatGroq({
      model: opts.groqModel,
      apiKey: opts.groqAPIKey,
      temperature: opts.temperature ?? 0.5,
      maxTokens: opts.maxTokens ?? 1024,
    })
  },

  gemini: (opts: GeminiOptions) => {
    return new ChatGoogleGenerativeAI({
      model: opts.geminiModel ?? 'gemini-3-pro-preview',
      apiKey: opts.geminiAPIKey,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 800,
    })
  },

  azure: (opts: AzureOptions) => {
    return new AzureChatOpenAI({
      model: opts.azureDeploymentName,
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 800,
      azureOpenAIApiKey: opts.azureAPIKey,
      azureOpenAIEndpoint: opts.azureAPIEndpoint,
      azureOpenAIApiDeploymentName: opts.azureDeploymentName,
      azureOpenAIApiVersion: opts.azureAPIVersion ?? '2024-10-01',
    })
  },

  openaiCompatible: (opts: OpenAICompatibleOptions) => {
    return new SystemFirstChatOpenAI({
      modelName: opts.model || '',
      configuration: {
        apiKey: opts.openaiCompatibleAPIKey || 'not-needed',
        baseURL: opts.openaiCompatibleBasePath,
      },
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 800,
      streaming: opts.streaming ?? true,
    })
  },
}

// const checkpointer = new MemorySaver()
const checkpointer = new IndexedDBSaver()

async function executeChatFlow(model: BaseChatModel, options: ProviderOptions): Promise<void> {
  try {
    if (!options.threadId) {
      options.threadId = crypto.randomUUID()
      log.info(`[Chat] New thread started: ${options.threadId}`)
    }
    const agent = createAgent({
      model,
      tools: [],
      checkpointer,
    })

    const useStreaming = (options as any).streaming !== false

    if (useStreaming) {
      const stream = await agent.stream(
        { messages: options.messages },
        {
          signal: options.abortSignal,
          configurable: { thread_id: options.threadId },
          streamMode: 'messages',
        },
      )

      let fullContent = ''
      for await (const chunk of stream) {
        if (options.abortSignal?.aborted) break
        const content = typeof chunk[0].content === 'string' ? chunk[0].content : ''
        fullContent += content
        options.onStream(fullContent)
      }
    } else {
      const result = await agent.invoke(
        { messages: options.messages },
        {
          signal: options.abortSignal,
          configurable: { thread_id: options.threadId },
        },
      )
      const messages = result.messages || []
      const lastMessage = messages[messages.length - 1] as any
      const content = typeof lastMessage?.content === 'string' ? lastMessage.content : ''
      options.onStream(content)
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || options.abortSignal?.aborted) {
      // Don't mark as error if intentionally aborted
      throw error
    }
    options.errorIssue.value = true
    log.error(error)
  } finally {
    options.loading.value = false
  }
}

async function executeAgentFlow(model: BaseChatModel, options: AgentOptions): Promise<void> {
  if (!options.threadId) {
    options.threadId = crypto.randomUUID()
  }

  const logger = new AgentLogger(options.threadId)

  try {
    const agent = createAgent({
      model,
      tools: options.tools || [],
      checkpointer,
    })

    const useStreaming = options.streaming !== false

    let fullContent = ''

    if (useStreaming) {
      const stream = await agent.stream(
        {
          messages: options.messages,
        },
        {
          recursionLimit: Number(options.recursionLimit),
          signal: options.abortSignal,
          configurable: {
            thread_id: options.threadId,
            checkpoint_id: options.checkpointId,
          },
          streamMode: 'values',
        },
      )

      let stepCount = 0

      for await (const step of stream) {
        if (options.abortSignal?.aborted) break

        stepCount++
        const messages = step.messages || []
        const lastMessage = messages[messages.length - 1]
        if (!lastMessage) continue

        const msg = lastMessage as any
        const messageType: string = msg._getType?.() || 'unknown'
        const agentStep = logger.startStep(stepCount, messageType)

        // AI message with tool calls — model is requesting tool execution
        if (messageType === 'ai' && msg.tool_calls?.length > 0) {
          for (const toolCall of msg.tool_calls) {
            logger.logToolCall(agentStep, toolCall.name, toolCall.args ?? {})
            options.onToolCall?.(toolCall.name, toolCall.args)
          }
        }

        // Tool result message — a tool finished executing
        if (messageType === 'tool') {
          const toolName = msg.name || 'unknown'
          const toolContent = String(msg.content ?? '')
          logger.logToolResult(toolName, toolContent)
          options.onToolResult?.(toolName, toolContent)
        }

        // AI message with text content and no further tool calls — final response
        if (messageType === 'ai' && msg.content) {
          const content = typeof msg.content === 'string' ? msg.content : ''
          if (content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
            fullContent = content
            logger.logAIResponse(fullContent)
            options.onStream(fullContent)
          }
        }
      }
    } else {
      const result = await agent.invoke(
        { messages: options.messages },
        {
          recursionLimit: Number(options.recursionLimit),
          signal: options.abortSignal,
          configurable: {
            thread_id: options.threadId,
            checkpoint_id: options.checkpointId,
          },
        },
      )
      const messages = result.messages || []
      let stepCount = 0
      for (const lastMessage of messages) {
        const msg = lastMessage as any
        const messageType: string = msg._getType?.() || 'unknown'
        stepCount++
        const agentStep = logger.startStep(stepCount, messageType)

        if (messageType === 'ai' && msg.tool_calls?.length > 0) {
          for (const toolCall of msg.tool_calls) {
            logger.logToolCall(agentStep, toolCall.name, toolCall.args ?? {})
            options.onToolCall?.(toolCall.name, toolCall.args)
          }
        }

        if (messageType === 'tool') {
          const toolName = msg.name || 'unknown'
          const toolContent = String(msg.content ?? '')
          logger.logToolResult(toolName, toolContent)
          options.onToolResult?.(toolName, toolContent)
        }

        if (messageType === 'ai' && msg.content) {
          const content = typeof msg.content === 'string' ? msg.content : ''
          if (content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
            fullContent = content
            logger.logAIResponse(fullContent)
            options.onStream(fullContent)
          }
        }
      }
    }

    logger.finalize(options.abortSignal?.aborted ? 'aborted' : 'completed')
  } catch (error: any) {
    if (error.name === 'AbortError' || options.abortSignal?.aborted) {
      logger.finalize('aborted')
      throw error
    }
    if (error.name === 'GraphRecursionError') {
      options.errorIssue.value = 'recursionLimitExceeded'
    }
    logger.finalize('error', error?.message || String(error))
    log.error('[Agent] Error:', error)
  } finally {
    options.loading.value = false
  }
}

export async function getChatResponse(options: ProviderOptions) {
  const creator = ModelCreators[options.provider]
  if (!creator) {
    throw new Error(`Unsupported provider: ${options.provider}`)
  }
  const model = creator(options)
  return executeChatFlow(model, options)
}

export async function getAgentResponse(options: AgentOptions) {
  const creator = ModelCreators[options.provider]
  if (!creator) {
    throw new Error(`Unsupported provider: ${options.provider}`)
  }
  const model = creator(options)
  return executeAgentFlow(model, options)
}
