'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent, type AIAgentResponse } from '@/lib/aiAgent'
import { useLyzrAgentEvents } from '@/lib/lyzrAgentEvents'
import { AgentActivityPanel } from '@/components/AgentActivityPanel'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { IoSend } from 'react-icons/io5'
import { FiExternalLink, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi'
import { BsCircleFill, BsGear, BsLink45Deg } from 'react-icons/bs'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

// --- Constants ---
const AGENT_ID = '6996c85c9c31ef5244578008'
const AGENT_NAME = 'Burnlab Support Agent'

const DEFAULT_CHIPS = [
  'How does Burnlab work?',
  'Pricing & Plans',
  'Book a Demo',
  'Customer Reviews',
  'Integration Options',
]

const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 'sample-1',
    role: 'user',
    content: 'How does Burnlab work?',
  },
  {
    id: 'sample-2',
    role: 'assistant',
    content: '**Burnlab** is an advanced analytics platform designed to help businesses understand customer behavior and optimize their digital experiences.\n\n### Key Features:\n- **Real-time Analytics** - Track user interactions as they happen\n- **Heatmap Visualization** - See where users click, scroll, and engage\n- **Session Recording** - Replay user sessions for deeper insights\n- **A/B Testing** - Run experiments to optimize conversion rates\n\nBurnlab integrates seamlessly with your existing tech stack and provides actionable insights within minutes of setup.\n\n[Learn more about Burnlab](https://burnlab.com/features)\n\nWould you like to [Book a Demo](https://burnlab.com/demo) to see it in action?',
    suggestedQuestions: ['What integrations does Burnlab support?', 'How much does Burnlab cost?', 'Can I try Burnlab for free?'],
    sources: ['https://burnlab.com/features', 'https://burnlab.com/docs'],
  },
  {
    id: 'sample-3',
    role: 'user',
    content: 'What are the pricing plans?',
  },
  {
    id: 'sample-4',
    role: 'assistant',
    content: '### Burnlab Pricing Plans\n\nBurnlab offers flexible pricing to suit teams of all sizes:\n\n1. **Starter** - $29/month\n   - Up to 10,000 sessions/month\n   - Basic analytics & heatmaps\n   - Email support\n\n2. **Professional** - $99/month\n   - Up to 100,000 sessions/month\n   - Advanced analytics, A/B testing\n   - Priority support\n\n3. **Enterprise** - Custom pricing\n   - Unlimited sessions\n   - Custom integrations & API access\n   - Dedicated account manager\n\nAll plans include a **14-day free trial** with no credit card required.\n\n[Start your free trial](https://burnlab.com/signup) or [Contact Sales](https://burnlab.com/contact) for enterprise pricing.',
    suggestedQuestions: ['Is there a free trial?', 'What payment methods do you accept?', 'Can I switch plans anytime?'],
    sources: ['https://burnlab.com/pricing'],
  },
]

// --- Types ---
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestedQuestions?: string[]
  sources?: string[]
  isError?: boolean
}

// --- Markdown Renderer ---
function formatInline(text: string): React.ReactNode {
  // Handle links [text](url)
  const linkParts = text.split(/\[([^\]]+)\]\(([^)]+)\)/g)
  if (linkParts.length > 1) {
    return linkParts.map((part, i) => {
      if (i % 3 === 1) {
        const url = linkParts[i + 1]
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(39,99%,50%)] hover:text-[hsl(39,99%,60%)] underline underline-offset-2 transition-colors duration-200 inline-flex items-center gap-1"
          >
            {part}
            <FiExternalLink className="h-3 w-3 inline-block flex-shrink-0" />
          </a>
        )
      }
      if (i % 3 === 2) return null
      // Process bold within non-link text
      return formatBoldItalic(part, `link-${i}`)
    })
  }
  return formatBoldItalic(text, 'root')
}

function formatBoldItalic(text: string, keyPrefix: string): React.ReactNode {
  // Handle **bold**
  const boldParts = text.split(/\*\*(.*?)\*\*/g)
  if (boldParts.length > 1) {
    return boldParts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        formatItalic(part, `${keyPrefix}-${i}`)
      )
    )
  }
  return formatItalic(text, keyPrefix)
}

function formatItalic(text: string, keyPrefix: string): React.ReactNode {
  const italicParts = text.split(/\*(.*?)\*/g)
  if (italicParts.length > 1) {
    return italicParts.map((part, i) =>
      i % 2 === 1 ? (
        <em key={`${keyPrefix}-i-${i}`} className="italic">
          {part}
        </em>
      ) : (
        part
      )
    )
  }
  return text
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1 text-foreground tracking-tight">
              {formatInline(line.slice(4))}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1 text-foreground tracking-tight">
              {formatInline(line.slice(3))}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-foreground tracking-tight">
              {formatInline(line.slice(2))}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm text-muted-foreground leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm text-muted-foreground leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (line.trim().startsWith('   - ') || line.trim().startsWith('   * '))
          return (
            <li key={i} className="ml-8 list-disc text-sm text-muted-foreground leading-relaxed">
              {formatInline(line.trim().slice(2))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// --- Typing Indicator ---
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <div className="h-8 w-8 rounded-full bg-[hsl(202,91%,41%)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[hsl(202,91%,41%)]/20">
        <HiOutlineSparkles className="h-4 w-4 text-white" />
      </div>
      <div className="bg-card border-2 border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.15s' }} />
          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  )
}

// --- Chat Bubble ---
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="max-w-[80%] bg-[hsl(202,91%,41%)] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg shadow-[hsl(202,91%,41%)]/20">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-1.5">
      <div className="h-8 w-8 rounded-full bg-[hsl(202,91%,41%)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[hsl(202,91%,41%)]/20 mt-0.5">
        <HiOutlineSparkles className="h-4 w-4 text-white" />
      </div>
      <div className="max-w-[80%] space-y-3">
        <div className={cn("bg-card border-2 border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg", message.isError && "border-destructive/50")}>
          {message.isError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{message.content}</span>
            </div>
          ) : (
            renderMarkdown(message.content)
          )}
        </div>
        {/* Sources */}
        {Array.isArray(message.sources) && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {message.sources.map((source, idx) => (
              <a
                key={idx}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[hsl(202,91%,41%)] transition-colors duration-200 bg-secondary/50 rounded-full px-3 py-1 border border-border hover:border-[hsl(202,91%,41%)]/30"
              >
                <BsLink45Deg className="h-3 w-3" />
                <span className="truncate max-w-[200px]">
                  {(() => {
                    try {
                      return new URL(source).hostname
                    } catch {
                      return source
                    }
                  })()}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Suggestion Chips ---
function SuggestionChips({ chips, onChipClick, disabled }: { chips: string[]; onChipClick: (chip: string) => void; disabled: boolean }) {
  if (!Array.isArray(chips) || chips.length === 0) return null

  return (
    <div className="px-4 py-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {chips.map((chip, idx) => (
          <button
            key={`${chip}-${idx}`}
            onClick={() => onChipClick(chip)}
            disabled={disabled}
            className="flex-shrink-0 px-4 py-2 text-sm rounded-full border-2 border-border bg-secondary/50 text-foreground hover:bg-[hsl(202,91%,41%)]/10 hover:border-[hsl(202,91%,41%)]/40 hover:text-[hsl(202,91%,41%)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed tracking-tight"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Welcome Section ---
function WelcomeSection({ onChipClick, disabled }: { onChipClick: (chip: string) => void; disabled: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="h-16 w-16 rounded-full bg-[hsl(202,91%,41%)] flex items-center justify-center mb-6 shadow-xl shadow-[hsl(202,91%,41%)]/30">
        <HiOutlineSparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">Hi! I'm Burnlab's support assistant.</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md leading-relaxed mb-8">
        How can I help you today? Ask me anything about Burnlab's features, pricing, integrations, and more.
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {DEFAULT_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => onChipClick(chip)}
            disabled={disabled}
            className="px-4 py-2.5 text-sm rounded-full border-2 border-border bg-card text-foreground hover:bg-[hsl(202,91%,41%)]/10 hover:border-[hsl(202,91%,41%)]/40 hover:text-[hsl(202,91%,41%)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md tracking-tight"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Agent Info Footer ---
function AgentInfoFooter({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <div className="px-4 py-2 border-t-2 border-border bg-card/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-[hsl(202,91%,41%)]/20 flex items-center justify-center">
            <BsGear className="h-3 w-3 text-[hsl(202,91%,41%)]" />
          </div>
          <span className="text-xs text-muted-foreground tracking-tight">
            Powered by <span className="font-semibold text-foreground">{AGENT_NAME}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <BsCircleFill className={cn("h-1.5 w-1.5", activeAgentId ? "text-[hsl(202,91%,41%)] animate-pulse" : "text-green-500")} />
          <span className="text-xs text-muted-foreground">{activeAgentId ? 'Processing' : 'Online'}</span>
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---
export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentChips, setCurrentChips] = useState<string[]>(DEFAULT_CHIPS)
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Agent activity monitoring
  const agentActivity = useLyzrAgentEvents(sessionId)

  // Generate session ID on mount
  useEffect(() => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    setSessionId(id)
  }, [])

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Displayed messages (sample or real)
  const displayedMessages = showSampleData && messages.length === 0 ? SAMPLE_MESSAGES : messages
  const displayedChips = showSampleData && messages.length === 0
    ? ['What integrations does Burnlab support?', 'How much does Burnlab cost?', 'Can I try Burnlab for free?']
    : currentChips

  // Send message handler
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)
    setActiveAgentId(AGENT_ID)
    agentActivity.setProcessing(true)

    try {
      const result: AIAgentResponse = await callAIAgent(trimmed, AGENT_ID, {
        session_id: sessionId ?? undefined,
      })

      if (result.success && result.response) {
        const agentResult = result.response.result || {}

        // Parse answer - try multiple paths
        const answer: string =
          agentResult.answer ||
          agentResult.text ||
          agentResult.message ||
          result.response.message ||
          (typeof agentResult === 'string' ? agentResult : '') ||
          'I apologize, I could not process your request.'

        // Parse suggested_questions with Array.isArray guard
        const suggestedQuestions: string[] =
          Array.isArray(agentResult.suggested_questions) ? agentResult.suggested_questions :
          Array.isArray(agentResult.suggestedQuestions) ? agentResult.suggestedQuestions :
          []

        // Parse sources with Array.isArray guard
        const sources: string[] =
          Array.isArray(agentResult.sources) ? agentResult.sources : []

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          suggestedQuestions,
          sources,
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Update chips with suggested questions or fallback to defaults
        if (suggestedQuestions.length > 0) {
          setCurrentChips(suggestedQuestions)
        } else {
          setCurrentChips(DEFAULT_CHIPS)
        }
      } else {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "I'm having trouble connecting. Please try again.",
          isError: true,
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again.",
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
      agentActivity.setProcessing(false)
    }
  }, [isLoading, sessionId, agentActivity])

  // Handle chip click
  const handleChipClick = useCallback((chip: string) => {
    sendMessage(chip)
  }, [sendMessage])

  // Handle keyboard events on textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  // Retry last failed message
  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMessage) {
      // Remove the error message
      setMessages((prev) => prev.filter((m) => !m.isError))
      sendMessage(lastUserMessage.content)
    }
  }, [messages, sendMessage])

  const hasMessages = displayedMessages.length > 0
  const lastMessage = displayedMessages[displayedMessages.length - 1]
  const showChipsAfterResponse = hasMessages && lastMessage?.role === 'assistant' && !lastMessage?.isError && !isLoading

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b-2 border-border bg-card shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[hsl(202,91%,41%)] flex items-center justify-center shadow-md shadow-[hsl(202,91%,41%)]/20">
            <HiOutlineSparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-tight">Burnlab Support</h1>
            <div className="flex items-center gap-1.5">
              <BsCircleFill className="h-1.5 w-1.5 text-green-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground tracking-tight">Sample Data</span>
            <Switch
              checked={showSampleData}
              onCheckedChange={setShowSampleData}
            />
          </label>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeSection onChipClick={handleChipClick} disabled={isLoading} />
        ) : (
          <div className="py-4 space-y-1">
            {displayedMessages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {/* Retry button for errors */}
            {lastMessage?.isError && !isLoading && (
              <div className="flex justify-start px-4 pl-[3.75rem]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryLastMessage}
                  className="gap-2 text-xs border-2 rounded-full hover:bg-[hsl(202,91%,41%)]/10 hover:border-[hsl(202,91%,41%)]/40 hover:text-[hsl(202,91%,41%)]"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  Try again
                </Button>
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && <TypingIndicator />}

            {/* Suggestion chips after response */}
            {showChipsAfterResponse && (
              <div className="pl-[2.75rem]">
                <SuggestionChips chips={displayedChips} onChipClick={handleChipClick} disabled={isLoading} />
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Agent Activity Panel (hidden by default per component logic) */}
      <AgentActivityPanel
        isConnected={agentActivity.isConnected}
        events={agentActivity.events}
        thinkingEvents={agentActivity.thinkingEvents}
        lastThinkingMessage={agentActivity.lastThinkingMessage}
        activeAgentId={agentActivity.activeAgentId}
        activeAgentName={agentActivity.activeAgentName}
        isProcessing={agentActivity.isProcessing}
      />

      {/* Agent Info Footer */}
      <AgentInfoFooter activeAgentId={activeAgentId} />

      {/* Input Bar */}
      <div className="px-4 py-3 border-t-2 border-border bg-card">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about Burnlab..."
              maxLength={500}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(202,91%,41%)]/50 focus:border-[hsl(202,91%,41%)]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 tracking-tight leading-relaxed"
            />
          </div>
          <Button
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            className="h-11 w-11 rounded-full bg-[hsl(202,91%,41%)] hover:bg-[hsl(202,91%,50%)] text-white shadow-lg shadow-[hsl(202,91%,41%)]/20 transition-all duration-200 disabled:opacity-40 disabled:shadow-none flex-shrink-0"
            size="icon"
          >
            {isLoading ? (
              <AiOutlineLoading3Quarters className="h-5 w-5 animate-spin" />
            ) : (
              <IoSend className="h-5 w-5" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 max-w-3xl mx-auto px-1">
          <span className="text-xs text-muted-foreground tracking-tight">
            Press Enter to send, Shift+Enter for new line
          </span>
          <span className="text-xs text-muted-foreground tracking-tight">
            {inputValue.length}/500
          </span>
        </div>
      </div>
    </div>
  )
}
