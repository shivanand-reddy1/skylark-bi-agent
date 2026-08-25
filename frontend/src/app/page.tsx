'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessageBubble, TypingIndicator } from '@/components/ChatMessage'
import { SuggestedQuestions } from '@/components/SuggestedQuestions'
import { StatusBar } from '@/components/StatusBar'
import { sendChatMessage, ChatMessage } from '@/lib/api'

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: `**Welcome to Skylark BI Agent** 👋

I'm connected to your Monday.com boards and ready to answer business intelligence questions about your **Deals pipeline** and **Work Orders**.

Here are some things I can help with:
- Total pipeline and weighted pipeline analysis
- Sector-wise performance breakdown
- Quarterly deal forecasts
- Work order execution and billing status
- Cross-board customer analysis
- Executive leadership updates

Ask me anything, or pick a suggested question below.`,
  timestamp: new Date(),
  dataQualityWarnings: [],
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = useCallback(async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || isLoading) return

    setInput('')
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // Build conversation history (last 6 turns)
    const history = [...messages, userMsg]
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await sendChatMessage(message, history)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        structuredData: response.structuredData,
        dataQualityWarnings: response.dataQualityWarnings,
        source: response.source,
        intent: response.intent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I ran into an issue: ${errMsg}`,
          timestamp: new Date(),
          isError: true,
          dataQualityWarnings: [],
        },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, isLoading, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 shadow-lg flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-inner">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Skylark Business Intelligence Agent</h1>
            <p className="text-xs text-slate-400 leading-tight">Monday.com · Deals & Work Orders</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusBar />
          <button
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto chat-scroll px-4 py-4 max-w-4xl mx-auto w-full">
        {messages.map((msg, idx) => (
          <ChatMessageBubble key={idx} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions + Input */}
      <div className="border-t border-slate-200 bg-white shadow-lg flex-shrink-0">
        {/* Show suggestions only when not loading and few messages */}
        {messages.length <= 3 && (
          <SuggestedQuestions onSelect={handleSend} disabled={isLoading} />
        )}

        {/* Input row */}
        <div className="px-4 pb-4 pt-2 max-w-4xl mx-auto w-full">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about pipeline, sectors, work orders, leadership update..."
                disabled={isLoading}
                rows={1}
                className="w-full resize-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 disabled:opacity-60 transition-all"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                }}
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Data from Monday.com · Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
