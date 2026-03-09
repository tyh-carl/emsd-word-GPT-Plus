// ─────────────────────────────────────────────────────────────────────────────
// AgentLogger — structured dev log for LangGraph agent runs
//
// Usage (DevTools console):
//   window.__agentLog          → latest session log object
//   window.__agentLogHistory   → array of last 20 sessions
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolCallEntry {
  seq: number                   // global call # within the session
  step: number                  // which agent step triggered this call
  toolName: string
  args: Record<string, any>
  calledAt: number
  result?: string
  success?: boolean             // false if result starts with "Error:"
  durationMs?: number
  completedAt?: number
}

export interface AgentStepEntry {
  step: number
  messageType: string           // 'ai' | 'tool' | 'human' | 'unknown'
  timestamp: number
  toolCalls: ToolCallEntry[]    // tool calls initiated in this step
  aiContent?: string            // set when AI emits a final response
}

export interface AgentSessionLog {
  sessionId: string
  threadId: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  status: 'running' | 'completed' | 'aborted' | 'error'
  errorMessage?: string
  steps: AgentStepEntry[]
  stats: {
    totalSteps: number
    totalToolCalls: number
    toolCallDetails: Record<string, {
      calls: number
      successes: number
      failures: number
      avgDurationMs: number
      totalDurationMs: number
    }>
  }
}

// ── Console styles ────────────────────────────────────────────────────────────

const S = {
  session:  'background:#0d1117;color:#58a6ff;font-weight:bold;padding:1px 6px;border-radius:3px',
  step:     'color:#8b949e;font-weight:bold',
  call:     'color:#d2a8ff;font-weight:bold',
  ok:       'color:#3fb950;font-weight:bold',
  err:      'color:#f85149;font-weight:bold',
  ai:       'color:#79c0ff;font-weight:bold',
  summary:  'background:#161b22;color:#f0f6fc;font-weight:bold;padding:1px 6px;border-radius:3px',
  muted:    'color:#6e7681',
}

// ── In-memory store ───────────────────────────────────────────────────────────

const MAX_STORED_SESSIONS = 20
const sessionHistory: AgentSessionLog[] = []

// ── AgentLogger class ─────────────────────────────────────────────────────────

export class AgentLogger {
  private session: AgentSessionLog
  private currentStep: AgentStepEntry | null = null
  // Queue per tool name to handle parallel tool calls correctly (FIFO match)
  private pendingCalls: Map<string, Array<{ entry: ToolCallEntry; startedAt: number }>> = new Map()
  private callSeq = 0

  constructor(threadId: string) {
    const sessionId = crypto.randomUUID().slice(0, 8)
    this.session = {
      sessionId,
      threadId,
      startedAt: Date.now(),
      status: 'running',
      steps: [],
      stats: {
        totalSteps: 0,
        totalToolCalls: 0,
        toolCallDetails: {},
      },
    }

    console.group(`%c▶ AgentLogger ${sessionId}`, S.session)
    console.log(`%c  thread   %c${threadId}`, S.muted, '')
    console.log(`%c  started  %c${new Date(this.session.startedAt).toLocaleTimeString()}`, S.muted, '')
    console.groupEnd()
  }

  // ── Step ──────────────────────────────────────────────────────────────────

  startStep(stepNumber: number, messageType: string): AgentStepEntry {
    const step: AgentStepEntry = {
      step: stepNumber,
      messageType,
      timestamp: Date.now(),
      toolCalls: [],
    }
    this.session.steps.push(step)
    this.session.stats.totalSteps = stepNumber
    this.currentStep = step

    console.log(
      `%c  Step ${String(stepNumber).padStart(3)} %c[${messageType}]`,
      S.step, S.muted,
    )
    return step
  }

  // ── Tool Call (model decides to call a tool) ──────────────────────────────

  logToolCall(step: AgentStepEntry, toolName: string, args: Record<string, any>): void {
    this.callSeq++
    const entry: ToolCallEntry = {
      seq: this.callSeq,
      step: step.step,
      toolName,
      args,
      calledAt: Date.now(),
    }
    step.toolCalls.push(entry)
    this.session.stats.totalToolCalls++

    // Init per-tool stats
    if (!this.session.stats.toolCallDetails[toolName]) {
      this.session.stats.toolCallDetails[toolName] = {
        calls: 0, successes: 0, failures: 0,
        avgDurationMs: 0, totalDurationMs: 0,
      }
    }
    this.session.stats.toolCallDetails[toolName].calls++

    // Queue for result matching
    if (!this.pendingCalls.has(toolName)) this.pendingCalls.set(toolName, [])
    this.pendingCalls.get(toolName)!.push({ entry, startedAt: Date.now() })

    // Truncate large string args for display only
    const displayArgs: Record<string, any> = {}
    for (const [k, v] of Object.entries(args)) {
      displayArgs[k] = typeof v === 'string' && v.length > 300
        ? `${v.substring(0, 300)} …[${v.length - 300} more chars]`
        : v
    }

    console.group(`%c    #${this.callSeq} → ${toolName}`, S.call)
    console.log('%c    args', S.muted, displayArgs)
    console.groupEnd()
  }

  // ── Tool Result (tool execution finished) ─────────────────────────────────

  logToolResult(toolName: string, result: string): void {
    const queue = this.pendingCalls.get(toolName)
    const pending = queue?.shift()
    const durationMs = pending ? Date.now() - pending.startedAt : 0
    const success = !result.trimStart().startsWith('Error:')

    // Attach result back onto the call entry
    if (pending) {
      pending.entry.result = result
      pending.entry.success = success
      pending.entry.durationMs = durationMs
      pending.entry.completedAt = Date.now()
    }

    // Update stats
    const stats = this.session.stats.toolCallDetails[toolName]
    if (stats) {
      if (success) stats.successes++
      else stats.failures++
      stats.totalDurationMs += durationMs
      stats.avgDurationMs = Math.round(stats.totalDurationMs / stats.calls)
    }

    const displayResult = result.length > 500
      ? `${result.substring(0, 500)} …[${result.length - 500} more chars]`
      : result

    if (success) {
      console.log(`%c    ✓ ${toolName} %c(${durationMs}ms)`, S.ok, S.muted, '\n    ', displayResult)
    } else {
      console.warn(`%c    ✗ ${toolName} %c(${durationMs}ms)\n    ${displayResult}`, S.err, S.muted)
    }
  }

  // ── AI final text response ────────────────────────────────────────────────

  logAIResponse(content: string): void {
    if (this.currentStep) {
      this.currentStep.aiContent = content
    }
    const preview = content.length > 400
      ? `${content.substring(0, 400)} …`
      : content
    console.log(`%c    💬 AI response%c\n    ${preview}`, S.ai, S.muted)
  }

  // ── Session end ───────────────────────────────────────────────────────────

  finalize(status: 'completed' | 'aborted' | 'error', errorMessage?: string): void {
    this.session.completedAt = Date.now()
    this.session.durationMs = this.session.completedAt - this.session.startedAt
    this.session.status = status
    if (errorMessage) this.session.errorMessage = errorMessage

    const statusLabel = status === 'completed' ? '✓ COMPLETED' : status === 'aborted' ? '⊘ ABORTED' : '✗ ERROR'
    const style = status === 'completed' ? S.ok : S.err

    console.group(`%c${statusLabel} %c${this.session.sessionId} | ${this.session.durationMs}ms`, style, S.muted)
    console.log(`%c  steps        %c${this.session.stats.totalSteps}`, S.muted, '')
    console.log(`%c  tool calls   %c${this.session.stats.totalToolCalls}`, S.muted, '')
    if (errorMessage) console.error('  error:', errorMessage)

    // Summary table
    if (Object.keys(this.session.stats.toolCallDetails).length > 0) {
      const tableData: Record<string, any> = {}
      for (const [name, d] of Object.entries(this.session.stats.toolCallDetails)) {
        tableData[name] = {
          calls: d.calls,
          '✓ ok': d.successes,
          '✗ err': d.failures,
          'avg ms': d.avgDurationMs,
        }
      }
      console.log('%c  Tool summary:', S.summary)
      console.table(tableData)
    }
    console.groupEnd()

    // Persist to store and expose on window for DevTools
    sessionHistory.push(this.session)
    if (sessionHistory.length > MAX_STORED_SESSIONS) sessionHistory.shift()
    ;(window as any).__agentLog = this.session
    ;(window as any).__agentLogHistory = sessionHistory
  }

  getSession(): AgentSessionLog {
    return this.session
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns the last completed session log. */
export function getLatestAgentLog(): AgentSessionLog | undefined {
  return sessionHistory[sessionHistory.length - 1]
}

/** Returns all stored session logs (up to last 20). */
export function getAgentLogHistory(): AgentSessionLog[] {
  return sessionHistory
}
