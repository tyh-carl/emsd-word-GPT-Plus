<template>
  <CheckPointsPage
    v-if="showCheckpoints"
    :thread-id="threadId"
    :saver="saver"
    :current-checkpoint-id="currentCheckpointId"
    @close="showCheckpoints = false"
    @restore="handleRestore"
    @select-thread="handleSelectThread"
  />
  <div
    v-show="!showCheckpoints"
    class="itemse-center relative flex h-full w-full flex-col justify-center bg-bg-secondary p-1"
  >
    <div class="relative flex h-full w-full flex-col gap-1 rounded-md">
      <!-- Header -->
      <div class="flex justify-between rounded-sm p-1">
        <div class="flex flex-1 items-center gap-2 text-accent">
          <img src="@/assets/images/splash.png" class="h-5 object-contain" alt="EMSD" />
          <span class="text-sm font-semibold text-main">{{ t('appName') }}</span>
        </div>
        <div class="flex items-center gap-1 rounded-md border border-accent/10">
          <CustomButton
            :title="t('newChat')"
            :icon="Plus"
            text=""
            type="secondary"
            class="border-none p-1!"
            :icon-size="18"
            @click="startNewChat"
          />
          <CustomButton
            :title="t('settings')"
            :icon="Settings"
            text=""
            type="secondary"
            class="border-none p-1!"
            :icon-size="18"
            @click="settings"
          />
          <CustomButton
            :title="t('checkPoints')"
            :icon="History"
            text=""
            type="secondary"
            class="border-none p-1!"
            :icon-size="18"
            @click="checkPoints"
          />
        </div>
      </div>

      <!-- Quick Actions Bar -->
      <div class="flex w-full items-center justify-center gap-2 overflow-hidden rounded-md">
        <CustomButton
          v-for="action in quickActions"
          :key="action.key"
          :title="action.label"
          text=""
          :icon="action.icon"
          type="secondary"
          :icon-size="16"
          class="shrink-0! bg-surface! p-1.5!"
          :disabled="loading"
          @click="applyQuickAction(action.key)"
        />
        <SingleSelect
          v-model="selectedPromptId"
          :key-list="savedPrompts.map(prompt => prompt.id)"
          :placeholder="t('selectPrompt')"
          title=""
          :fronticon="false"
          class="max-w-xs! flex-1! bg-surface! text-xs!"
          @change="loadSelectedPrompt"
        >
          <template #item="{ item }">
            {{ savedPrompts.find(prompt => prompt.id === item)?.name || item }}
          </template>
        </SingleSelect>
      </div>

      <!-- Chat Messages Container -->
      <div
        ref="messagesContainer"
        class="flex flex-1 flex-col gap-4 overflow-y-auto rounded-md border border-border-secondary bg-surface p-2 shadow-sm"
      >
        <div
          v-if="history.length === 0"
          class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-accent"
        >
          <img src="@/assets/images/splash.png" class="h-15 object-contain" alt="EMSD" />
          <p class="font-semibold text-main">
            {{ $t('emptyTitle') }}
          </p>
          <p class="text-xs font-semibold text-secondary">
            {{ $t('emptySubtitle') }}
          </p>
        </div>

        <div
          v-for="(msg, index) in displayHistory"
          :key="msg.id || index"
          class="group flex items-end gap-4 [.user]:flex-row-reverse"
          :class="msg instanceof AIMessage ? 'assistant' : 'user'"
        >
          <div
            class="flex min-w-0 flex-1 flex-col gap-1 group-[.assistant]:items-start group-[.assistant]:text-left group-[.user]:items-end group-[.user]:text-left"
          >
            <div
              class="group max-w-[95%] rounded-md border border-border-secondary p-1 text-sm leading-[1.4] wrap-break-word whitespace-pre-wrap text-main/90 shadow-sm group-[.assistant]:bg-bg-tertiary group-[.assistant]:text-left group-[.user]:bg-accent/10"
            >
              <template v-for="(segment, idx) in renderSegments(msg)" :key="idx">
                <span v-if="segment.type === 'text'">{{ segment.text.trim() }}</span>
                <details v-else-if="segment.type === 'think'" class="mb-1 rounded-sm border border-border-secondary bg-bg-secondary">
                  <summary class="cursor-pointer list-none p-1 text-sm font-semibold text-secondary">
                    Thought process
                  </summary>
                  <pre class="m-0 p-1 text-xs wrap-break-word whitespace-pre-wrap text-secondary">{{
                    segment.text.trim()
                  }}</pre>
                </details>
                <details v-else-if="segment.type === 'tool'" class="mb-1 rounded-sm border border-border-secondary bg-bg-secondary">
                  <summary class="cursor-pointer list-none p-1 text-sm font-semibold text-secondary">
                    🔧 {{ t('toolCallsUsed') }}
                  </summary>
                  <pre class="m-0 p-1 text-xs wrap-break-word whitespace-pre-wrap text-secondary">{{
                    segment.text.trim()
                  }}</pre>
                </details>
              </template>
            </div>
            <div v-if="!(msg instanceof AIMessage) && index === lastHumanMessageIndex" class="flex gap-1">
              <CustomButton
                :title="t('regenerate')"
                text=""
                :icon="RefreshCw"
                type="secondary"
                class="bg-surface! p-1.5! text-secondary!"
                :icon-size="12"
                :disabled="loading"
                @click="regenerateFrom(index)"
              />
            </div>
            <div v-if="msg instanceof AIMessage" class="flex gap-1">
              <CustomButton
                :title="t('replaceSelectedText')"
                text=""
                :icon="FileText"
                type="secondary"
                class="bg-surface! p-1.5! text-secondary!"
                :icon-size="12"
                @click="insertToDocument(cleanMessageText(msg), 'replace')"
              />
              <CustomButton
                :title="t('appendToSelection')"
                text=""
                :icon="Plus"
                type="secondary"
                class="bg-surface! p-1.5! text-secondary!"
                :icon-size="12"
                @click="insertToDocument(cleanMessageText(msg), 'append')"
              />
              <CustomButton
                :title="t('copyToClipboard')"
                text=""
                :icon="Copy"
                type="secondary"
                class="bg-surface! p-1.5! text-secondary!"
                :icon-size="12"
                @click="copyToClipboard(cleanMessageText(msg))"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="flex flex-col gap-1 rounded-md">
        <div class="flex items-center justify-between gap-2 overflow-hidden">
          <div class="flex shrink-0 gap-1 rounded-sm border border-border bg-surface p-0.5">
            <button
              class="cursor-po flex h-7 w-7 items-center justify-center rounded-md border-none text-secondary hover:bg-accent/30 hover:text-white! [.active]:text-accent"
              :class="{ active: mode === 'ask' }"
              title="Ask Mode"
              @click="mode = 'ask'"
            >
              <MessageSquare :size="14" />
            </button>
            <button
              class="cursor-po flex h-7 w-7 items-center justify-center rounded-md border-none text-secondary hover:bg-accent/30 hover:text-white! [.active]:text-accent"
              :class="{ active: mode === 'agent' }"
              title="Agent Mode"
              @click="mode = 'agent'"
            >
              <BotMessageSquare :size="17" />
            </button>
          </div>
          <div class="flex min-w-0 flex-1 gap-1 overflow-hidden">
            <select
              v-model="settingForm.api"
              class="h-7 max-w-full min-w-0 cursor-pointer rounded-md border border-border bg-surface p-1 text-xs text-secondary hover:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-secondary"
            >
              <option v-for="item in settingPreset.api.optionObj" :key="item.value" :value="item.value">
                {{ item.label.replace('official', 'OpenAI') }}
              </option>
            </select>
            <select
              v-if="currentModelOptions && currentModelOptions.length > 0"
              v-model="currentModelSelect"
              class="h-7 max-w-full min-w-0 cursor-pointer rounded-md border border-border bg-surface p-1 text-xs text-secondary hover:border-accent focus:outline-none"
            >
              <option v-for="item in currentModelOptions" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </div>
        </div>
        <!-- Drag handle -->
        <div
          class="flex h-2 cursor-row-resize items-center justify-center"
          :class="{ 'opacity-100': isDragging, 'opacity-40 hover:opacity-80': !isDragging }"
          @pointerdown="onDragStart"
        >
          <div class="h-0.5 w-8 rounded-full bg-border transition-opacity" />
        </div>
        <div
          class="flex min-w-12 items-start gap-2 overflow-hidden rounded-md border border-border bg-surface p-2 focus-within:border-accent"
          :class="{ '!bg-gray-200 opacity-50': loading }"
          :style="{ height: containerHeight + 'px' }"
          @click="inputTextarea?.focus()"
        >
          <textarea
            ref="inputTextarea"
            v-model="userInput"
            class="placeholder::text-secondary block flex-1 resize-none overflow-y-auto border-none bg-transparent py-2 text-xs leading-normal text-main outline-none placeholder:text-xs disabled:cursor-not-allowed"
            :placeholder="mode === 'ask' ? $t('askAnything') : $t('directTheAgent')"
            :disabled="loading"
            rows="1"
            @keydown.enter.exact.prevent="sendMessage"
            @input="adjustTextareaHeight"
          />
          <button
            v-if="loading"
            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-end rounded-sm border-none bg-danger text-white"
            title="Stop"
            @click="stopGeneration"
          >
            <Square :size="18" />
          </button>
          <button
            v-else
            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-end rounded-sm border-none bg-accent text-white disabled:cursor-not-allowed disabled:bg-accent/50"
            title="Send"
            :disabled="!userInput.trim()"
            @click="sendMessage"
          >
            <Send :size="18" />
          </button>
        </div>
        <div class="flex justify-center gap-3 px-1">
          <label class="flex h-3.5 w-3.5 flex-1 cursor-pointer items-center gap-1 text-xs text-secondary">
            <input v-model="useWordFormatting" type="checkbox" />
            <span>{{ $t('useWordFormattingLabel') }}</span>
          </label>
          <label class="flex h-3.5 w-3.5 flex-1 cursor-pointer items-center gap-1 text-xs text-secondary">
            <input v-model="useSelectedText" type="checkbox" />
            <span>{{ $t('includeSelectionLabel') }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AIMessage, HumanMessage, type Message, SystemMessage } from '@langchain/core/messages'
import { useStorage } from '@vueuse/core'
import {
  BookOpen,
  BotMessageSquare,
  CheckCircle,
  Copy,
  FileCheck,
  FileText,
  Globe,
  History,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkle,
  Square,
} from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { type CheckpointTuple, IndexedDBSaver } from '@/api/checkpoints'
import { insertFormattedResult, insertResult } from '@/api/common'
import CustomButton from '@/components/CustomButton.vue'
import SingleSelect from '@/components/SingleSelect.vue'
import { useChat } from '@/composables/useChat'
import { useResizableTextarea } from '@/composables/useResizableTextarea'
import CheckPointsPage from '@/pages/checkPointsPage.vue'
import { checkAuth } from '@/utils/common'
import { buildInPrompt, getBuiltInPrompt } from '@/utils/constant'
import { localStorageKey } from '@/utils/enum'
import { message as messageUtil } from '@/utils/message'
import useSettingForm from '@/utils/settingForm'
import { settingPreset } from '@/utils/settingPreset'

const router = useRouter()
const { t } = useI18n()

const settingForm = useSettingForm()

interface SavedPrompt {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
}

const savedPrompts = ref<SavedPrompt[]>([])
const selectedPromptId = ref<string>('')
const customSystemPrompt = ref<string>('')

function loadSavedPrompts() {
  const stored = localStorage.getItem('savedPrompts')
  if (stored) {
    try {
      savedPrompts.value = JSON.parse(stored)
    } catch (error) {
      console.error('Error loading saved prompts:', error)
      savedPrompts.value = []
    }
  }
}

function loadSelectedPrompt() {
  if (!selectedPromptId.value) {
    customSystemPrompt.value = ''
    return
  }

  const prompt = savedPrompts.value.find(p => p.id === selectedPromptId.value)
  if (prompt) {
    customSystemPrompt.value = prompt.systemPrompt
    userInput.value = prompt.userPrompt
    adjustTextareaHeight()

    if (inputTextarea.value) {
      inputTextarea.value.focus()
    }
  }
}

// Chat state
const mode = useStorage(localStorageKey.chatMode, 'ask' as 'ask' | 'agent')
const userInput = ref('')
const messagesContainer = ref<HTMLElement>()
const inputTextarea = ref<HTMLTextAreaElement>()
const showCheckpoints = ref(false)
const saver = new IndexedDBSaver()

// Settings
const useWordFormatting = useStorage(localStorageKey.useWordFormatting, true)
const useSelectedText = useStorage(localStorageKey.useSelectedText, true)
const insertType = ref<insertTypes>('replace')

const { containerHeight, isDragging, onDragStart } = useResizableTextarea()

const {
  history,
  loading,
  abortController,
  threadId,
  currentCheckpointId,
  processChat,
  stopGeneration,
  getMessageText,
} = useChat({
  settingForm,
  mode,
  customSystemPrompt,
  onScrollToBottom: () => scrollToBottom(),
})

const displayHistory = computed(() => {
  return history.value.filter(msg => {
    if (msg instanceof SystemMessage) return false
    if (msg instanceof AIMessage && (msg as any).tool_calls?.length > 0) return false
    return true
  })
})

const lastHumanMessageIndex = computed(() => {
  const arr = displayHistory.value
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!(arr[i] instanceof AIMessage)) return i
  }
  return -1
})

// Quick actions
const quickActions: {
  key: keyof typeof buildInPrompt
  label: string
  icon: any
}[] = [
  { key: 'translate', label: t('translate'), icon: Globe },
  { key: 'polish', label: t('polish'), icon: Sparkle },
  { key: 'academic', label: t('academic'), icon: BookOpen },
  { key: 'summary', label: t('summary'), icon: FileCheck },
  { key: 'grammar', label: t('grammar'), icon: CheckCircle },
]

const getCustomModels = (key: string, oldKey: string): string[] => {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  const oldModel = localStorage.getItem(oldKey)
  if (oldModel && oldModel.trim()) {
    return [oldModel]
  }
  return []
}

const currentModelOptions = computed(() => {
  let presetOptions: string[] = []
  let customModels: string[] = []

  switch (settingForm.value.api) {
    case 'official':
      presetOptions = settingPreset.officialModelSelect.optionList || []
      customModels = getCustomModels('customModels', 'customModel')
      break
    case 'gemini':
      presetOptions = settingPreset.geminiModelSelect.optionList || []
      customModels = getCustomModels('geminiCustomModels', 'geminiCustomModel')
      break
    case 'ollama':
      presetOptions = settingPreset.ollamaModelSelect.optionList || []
      customModels = getCustomModels('ollamaCustomModels', 'ollamaCustomModel')
      break
    case 'groq':
      presetOptions = settingPreset.groqModelSelect.optionList || []
      customModels = getCustomModels('groqCustomModels', 'groqCustomModel')
      break
    case 'openaiCompatible':
      presetOptions = settingPreset.openaiCompatibleModelSelect.optionList || []
      customModels = getCustomModels('openaiCompatibleCustomModels', 'openaiCompatibleModel')
      break
    case 'azure':
      return []
    default:
      return []
  }

  return [...presetOptions, ...customModels]
})

const currentModelSelect = computed({
  get() {
    switch (settingForm.value.api) {
      case 'official':
        return settingForm.value.officialModelSelect
      case 'gemini':
        return settingForm.value.geminiModelSelect
      case 'ollama':
        return settingForm.value.ollamaModelSelect
      case 'groq':
        return settingForm.value.groqModelSelect
      case 'azure':
        return settingForm.value.azureDeploymentName
      case 'openaiCompatible':
        return settingForm.value.openaiCompatibleModelSelect
      default:
        return ''
    }
  },
  set(value) {
    switch (settingForm.value.api) {
      case 'official':
        settingForm.value.officialModelSelect = value
        localStorage.setItem(localStorageKey.model, value)
        break
      case 'gemini':
        settingForm.value.geminiModelSelect = value
        localStorage.setItem(localStorageKey.geminiModel, value)
        break
      case 'ollama':
        settingForm.value.ollamaModelSelect = value
        localStorage.setItem(localStorageKey.ollamaModel, value)
        break
      case 'groq':
        settingForm.value.groqModelSelect = value
        localStorage.setItem(localStorageKey.groqModel, value)
        break
      case 'azure':
        settingForm.value.azureDeploymentName = value
        localStorage.setItem(localStorageKey.azureDeploymentName, value)
        break
    }
  },
})

function settings() {
  // FIXME: 使用路由方式会改变当前的threadID,进而重置页面
  router.push('/settings')
}

function checkPoints() {
  showCheckpoints.value = true
}

function startNewChat() {
  if (loading.value) {
    stopGeneration()
  }
  userInput.value = ''
  history.value = []
  threadId.value = uuidv4()
  customSystemPrompt.value = ''
  selectedPromptId.value = ''
  adjustTextareaHeight()
}

function adjustTextareaHeight() {
  if (inputTextarea.value) {
    inputTextarea.value.style.height = 'auto'
    const maxH = Math.max(containerHeight.value - 16, 40) // 16px accounts for container p-2 padding
    inputTextarea.value.style.height = Math.min(inputTextarea.value.scrollHeight, maxH) + 'px'
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  if (!userInput.value.trim() || loading.value) return
  if (!checkApiKey()) return

  const userMessage = userInput.value.trim()
  userInput.value = ''
  adjustTextareaHeight()

  // Get selected text from Word
  let selectedText = ''
  if (useSelectedText.value) {
    selectedText = await Word.run(async ctx => {
      const range = ctx.document.getSelection()
      range.load('text')
      await ctx.sync()
      return range.text
    })
  }

  // Add user message
  const fullMessage = new HumanMessage(
    selectedText ? `${userMessage}\n\n[Selected text: "${selectedText}"]` : userMessage,
  )

  loading.value = true
  abortController.value = new AbortController()

  try {
    await processChat(fullMessage, undefined)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      messageUtil.info(t('generationStop'))
    } else {
      console.error(error)
      messageUtil.error(t('failedToResponse'))
      history.value.pop()
    }
  } finally {
    loading.value = false
    abortController.value = null
  }
}

async function regenerateFrom(index: number) {
  if (loading.value) return

  const msg = displayHistory.value[index]
  const msgText = getMessageText(msg)
  const historyIndex = history.value.indexOf(msg)

  // Truncate history back to just before this human message
  history.value = history.value.slice(0, historyIndex)
  // Reset threadId so LangGraph starts a fresh checkpoint instead of
  // appending onto the old one (which still has the full original history)
  threadId.value = uuidv4()

  loading.value = true
  abortController.value = new AbortController()
  try {
    await processChat(new HumanMessage(msgText), undefined)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      messageUtil.info(t('generationStop'))
    } else {
      console.error(error)
      messageUtil.error(t('failedToResponse'))
      history.value.pop()
    }
  } finally {
    loading.value = false
    abortController.value = null
  }
}

async function applyQuickAction(actionKey: keyof typeof buildInPrompt) {
  if (!checkApiKey()) return

  // Get selected text
  const selectedText = await Word.run(async ctx => {
    const range = ctx.document.getSelection()
    range.load('text')
    await ctx.sync()
    return range.text
  })

  if (!selectedText) {
    messageUtil.error(t('selectTextPrompt'))
    return
  }

  const builtInPrompts = getBuiltInPrompt()
  const action = builtInPrompts[actionKey]
  const settings = settingForm.value
  const { replyLanguage: lang } = settings

  const systemMessage = action.system(lang)
  const userMessage = new HumanMessage(action.user(selectedText, lang))

  loading.value = true
  abortController.value = new AbortController()

  try {
    await processChat(userMessage, systemMessage)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      messageUtil.info(t('generationStop'))
    } else {
      console.error(error)
      messageUtil.error(t('failedToProcessAction'))
      // Remove failed message
      history.value.pop()
    }
  } finally {
    loading.value = false
    abortController.value = null
  }
}

async function insertToDocument(content: string, type: insertTypes) {
  insertType.value = type

  if (useWordFormatting.value) {
    await insertFormattedResult(content, insertType)
  } else {
    insertResult(content, insertType)
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  messageUtil.success(t('copied'))
}

function checkApiKey() {
  const auth = {
    type: settingForm.value.api as supportedPlatforms,
    apiKey: settingForm.value.officialAPIKey,
    azureAPIKey: settingForm.value.azureAPIKey,
    geminiAPIKey: settingForm.value.geminiAPIKey,
    groqAPIKey: settingForm.value.groqAPIKey,
  }
  if (!checkAuth(auth)) {
    messageUtil.error(t('noAPIKey'))
    return false
  }
  return true
}

const THINK_TAG = '<think>'
const THINK_TAG_END = '</think>'
const TOOL_CALLS_TAG = '<tool_calls>'
const TOOL_CALLS_TAG_END = '</tool_calls>'

interface RenderSegment {
  type: 'text' | 'think' | 'tool'
  text: string
}

const cleanMessageText = (msg: Message): string => {
  const raw = getMessageText(msg)
  return raw
    .replace(new RegExp(`${THINK_TAG}[\\s\\S]*?${THINK_TAG_END}`, 'g'), '')
    .replace(new RegExp(`${TOOL_CALLS_TAG}[\\s\\S]*?${TOOL_CALLS_TAG_END}`, 'g'), '')
    .trim()
}

const splitSegments = (text: string): RenderSegment[] => {
  if (!text) return []

  const TAGS = [
    { open: THINK_TAG, close: THINK_TAG_END, type: 'think' as const },
    { open: TOOL_CALLS_TAG, close: TOOL_CALLS_TAG_END, type: 'tool' as const },
  ]

  const segments: RenderSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    // Find the nearest opening tag
    let nearestStart = -1
    let nearestTag = TAGS[0]
    for (const tag of TAGS) {
      const idx = text.indexOf(tag.open, cursor)
      if (idx !== -1 && (nearestStart === -1 || idx < nearestStart)) {
        nearestStart = idx
        nearestTag = tag
      }
    }

    if (nearestStart === -1) {
      segments.push({ type: 'text', text: text.slice(cursor) })
      break
    }

    if (nearestStart > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, nearestStart) })
    }

    const contentStart = nearestStart + nearestTag.open.length
    const end = text.indexOf(nearestTag.close, contentStart)
    if (end === -1) {
      segments.push({ type: nearestTag.type, text: text.slice(contentStart) })
      break
    }

    segments.push({ type: nearestTag.type, text: text.slice(contentStart, end) })
    cursor = end + nearestTag.close.length
  }

  return segments.filter(segment => segment.text.trim())
}

const renderSegments = (msg: Message): RenderSegment[] => {
  const raw = getMessageText(msg)
  return splitSegments(raw)
}

const addWatch = () => {
  watch(
    () => settingForm.value.replyLanguage,
    () => {
      localStorage.setItem(localStorageKey.replyLanguage, settingForm.value.replyLanguage)
    },
  )
  watch(
    () => settingForm.value.api,
    () => {
      localStorage.setItem(localStorageKey.api, settingForm.value.api)
    },
  )
  watch(
    () => history.value.length,
    () => scrollToBottom(),
  )
}

async function initData() {
  insertType.value = (localStorage.getItem(localStorageKey.insertType) as insertTypes) || 'replace'
}

function reconstructMessages(rawMessages: any[]): Message[] {
  const result: Message[] = []
  let pendingToolNames: string[] = []

  for (const msg of rawMessages) {
    if (msg.type === 'human') {
      pendingToolNames = []
      result.push(new HumanMessage(msg.content))
    } else if (msg.type === 'tool') {
      if (msg.name) pendingToolNames.push(msg.name)
    } else if (msg.type === 'ai') {
      const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0
      if (hasToolCalls) {
        // Intermediate AI message — skip, kept in tool_calls for displayHistory filter
        result.push(new AIMessage({ content: msg.content, tool_calls: msg.tool_calls }))
      } else {
        // Final AI message — prepend collected tool names as <tool_calls> block
        let content = msg.content ?? ''
        if (pendingToolNames.length > 0) {
          content = '<tool_calls>' + pendingToolNames.join('\n') + '</tool_calls>\n\n' + content
          pendingToolNames = []
        }
        result.push(new AIMessage({ content, tool_calls: [] }))
      }
    }
  }

  return result
}

async function handleRestore(checkpointId: string) {
  currentCheckpointId.value = checkpointId
  showCheckpoints.value = false

  // Fetch the history up to the selected checkpoint
  const checkpointTuple = await saver.getTuple({
    configurable: { thread_id: threadId.value, checkpoint_id: checkpointId },
  })

  if (checkpointTuple) {
    const messages = checkpointTuple.checkpoint.channel_values.messages
    if (messages && Array.isArray(messages)) {
      history.value = reconstructMessages(messages)
    }
  }
}

async function loadThreadHistory(targetThreadId: string) {
  const checkpoints: CheckpointTuple[] = []
  const iterator = saver.list({
    configurable: { thread_id: targetThreadId },
  })

  for await (const checkpoint of iterator) {
    checkpoints.push(checkpoint)
  }

  if (checkpoints.length > 0) {
    checkpoints.sort((a, b) => (a.metadata?.step ?? 0) - (b.metadata?.step ?? 0))

    const latestCheckpoint = checkpoints[checkpoints.length - 1]
    const messages = latestCheckpoint.checkpoint.channel_values.messages
    if (messages && Array.isArray(messages)) {
      history.value = reconstructMessages(messages)
      currentCheckpointId.value = latestCheckpoint.config.configurable?.checkpoint_id || ''
    } else {
      history.value = []
      currentCheckpointId.value = ''
    }
  } else {
    // No checkpoints found for this thread
    history.value = []
    currentCheckpointId.value = ''
  }
  await scrollToBottom()
}

async function handleSelectThread(newThreadId: string) {
  threadId.value = newThreadId
  showCheckpoints.value = false
  await loadThreadHistory(newThreadId)
}

onBeforeMount(() => {
  addWatch()
  initData()
  loadSavedPrompts()

  if (threadId.value) {
    loading.value = true // 可选：显示加载状态
    try {
      loadThreadHistory(threadId.value)
    } catch (e) {
      console.error('Auto reload history failed:', e)
    } finally {
      loading.value = false
    }
  }
})
</script>
