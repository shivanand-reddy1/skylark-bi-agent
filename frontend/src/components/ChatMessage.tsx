'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage } from '@/lib/api'

interface Props {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-2 max-w-[85%]">
        {/* Avatar */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mt-1">
          <span className="text-white text-xs font-bold">S</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Main answer */}
          <div
            className={`bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border ${
              message.isError ? 'border-red-200 bg-red-50' : 'border-slate-100'
            }`}
          >
            <div className={`text-sm prose-chat ${message.isError ? 'text-red-700' : 'text-slate-700'}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Data quality warnings - only show if NOT already in the answer */}
          {message.dataQualityWarnings && message.dataQualityWarnings.length > 0 && 
           !message.content.includes('Data Caveats') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <span>⚠️</span> Data Quality Notes
              </p>
              <ul className="space-y-0.5">
                {message.dataQualityWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source and metadata */}
          {message.source && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-slate-400">
                📊 {message.source.replace(' — AI explanation unavailable', '')}
              </span>
              {message.intent && message.intent !== 'unknown' && (
                <span className="text-xs text-slate-300">•</span>
              )}
              {message.intent && message.intent !== 'unknown' && (
                <span className="text-xs text-slate-400 capitalize">
                  {message.intent.replace(/_/g, ' ')}
                </span>
              )}
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs text-slate-400">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100">
          <div className="flex items-center gap-1 h-4">
            <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
            <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
            <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
          </div>
        </div>
      </div>
    </div>
  )
}
