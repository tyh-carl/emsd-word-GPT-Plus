# Add collapsible tool call section in agent messages

## Context
In agent mode, tool call status lines (`🔧 Calling tool: X...` / `✅ Tool X completed`) are appended to the AI message during execution. But when the final AI response arrives, `onStream` **overwrites** the entire message content, losing the tool call info. The user wants tool call items preserved and shown in a collapsible `<details>` section above the final response.

## Approach
1. Track tool call names separately in `useChat.ts`
2. When `onStream` fires with the final response, prepend the accumulated tool call summary
3. Extend the segment parser to detect tool call blocks and create a `'tool'` segment type
4. Render tool segments in a collapsible `<details>/<summary>` block (same pattern as `<think>` tags)

## Files to Modify

### 1. `src/composables/useChat.ts` — Preserve tool calls in final message

Add a `ref` to track tool call names during agent execution, and prepend them when `onStream` fires.

**a)** Add tracking ref near line 127:
```ts
const toolCallLog = ref<string[]>([])
```

**b)** In `sendMessage` (agent mode block, ~line 222), reset the log before agent call:
```ts
toolCallLog.value = []
```

**c)** In `onToolResult` callback (~line 246), push the tool name:
```ts
onToolResult: (toolName: string, _result: string) => {
  toolCallLog.value.push(toolName)
  // ... existing replace logic unchanged ...
},
```

**d)** In `onStream` callback (~line 235), prepend tool call summary:
```ts
onStream: (text: string) => {
  const lastIndex = history.value.length - 1
  if (toolCallLog.value.length > 0) {
    const toolSection = '<tool_calls>' + toolCallLog.value.map(name => `✅ ${name}`).join('\n') + '</tool_calls>'
    history.value[lastIndex] = new AIMessage(toolSection + '\n\n' + text)
  } else {
    history.value[lastIndex] = new AIMessage(text)
  }
  onScrollToBottom()
},
```

### 2. `src/pages/HomePage.vue` — Parse and render tool call segments

**a)** Extend `RenderSegment` type (~line 698):
```ts
interface RenderSegment {
  type: 'text' | 'think' | 'tool'
  text: string
}
```

**b)** Update `splitThinkSegments` to also parse `<tool_calls>...</tool_calls>` blocks, producing segments with `type: 'tool'`. Rename to `splitSegments` for clarity. The parser should handle both `<think>` and `<tool_calls>` tags in a single pass.

**c)** Add a `<details>` block in the template for `'tool'` segments (~line 114), similar to the existing think pattern:
```html
<details v-else-if="segment.type === 'tool'" class="mb-1 rounded-sm border border-border-secondary bg-bg-secondary">
  <summary class="cursor-pointer list-none p-1 text-sm font-semibold text-secondary">
    🔧 {{ t('toolCallsUsed') }}
  </summary>
  <pre class="m-0 p-1 text-xs wrap-break-word whitespace-pre-wrap text-secondary">{{
    segment.text.trim()
  }}</pre>
</details>
```

**d)** Update `cleanMessageText` (~line 699) to also strip `<tool_calls>...</tool_calls>` blocks so they are excluded when inserting to Word document or copying to clipboard.

### 3. `src/i18n/locales/en.json` & `zh-hk.json` — Add i18n label

**en.json:**
```json
"toolCallsUsed": "Tool calls"
```

**zh-hk.json:**
```json
"toolCallsUsed": "工具呼叫"
```

## Verification
1. Run `npm run dev`
2. In agent mode, give a task that uses tools (e.g. "append 'hello' to the document")
3. During execution: tool call status lines appear as normal
4. After completion: final message shows a collapsed `🔧 Tool calls` section above the AI response
5. Click to expand — see the list of tools used
6. Copy/insert to document — tool call section should be stripped
7. Normal chat mode (no tools) — no tool call section appears
