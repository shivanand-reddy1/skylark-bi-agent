'use client'

import { useEffect, useState } from 'react'
import { checkHealth } from '@/lib/api'

export function StatusBar() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [mondayStatus, setMondayStatus] = useState<string>('...')

  useEffect(() => {
    const check = async () => {
      try {
        const health = await checkHealth()
        setStatus(health.status === 'ok' ? 'connected' : 'error')
        setMondayStatus(health.monday)
      } catch {
        setStatus('error')
        setMondayStatus('unreachable')
      }
    }
    check()
    const interval = setInterval(check, 60000) // re-check every minute
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'connected'
              ? 'bg-green-400'
              : status === 'error'
              ? 'bg-red-400'
              : 'bg-yellow-400 animate-pulse'
          }`}
        />
        <span className="text-slate-400">
          {status === 'checking' ? 'Connecting...' : status === 'connected' ? 'Live' : 'Offline'}
        </span>
      </div>
      <span className="text-slate-300">|</span>
      <span className="text-slate-400">
        Monday.com: <span className={mondayStatus === 'connected' ? 'text-green-500' : 'text-slate-400'}>{mondayStatus}</span>
      </span>
    </div>
  )
}
