export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  structuredData?: unknown
  dataQualityWarnings?: string[]
  source?: string
  intent?: string
  timestamp: Date
  isError?: boolean
}

export interface ChatResponse {
  answer: string
  structuredData?: unknown
  dataQualityWarnings: string[]
  source: string
  intent: string
  needsClarification?: boolean
  clarificationQuestion?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal: AbortSignal.timeout(60000), // 60 second timeout
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Server error: ${response.status}`)
  }

  return response.json() as Promise<ChatResponse>
}

export async function checkHealth(): Promise<{ status: string; monday: string }> {
  const response = await fetch(`${API_BASE}/api/health`, {
    signal: AbortSignal.timeout(5000),
  })
  return response.json()
}
