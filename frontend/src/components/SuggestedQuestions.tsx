'use client'

interface Props {
  onSelect: (question: string) => void
  disabled?: boolean
}

const SUGGESTED_QUESTIONS = [
  { label: '📊 Pipeline Overview', text: 'What is our total pipeline?' },
  { label: '📅 This Quarter', text: 'How many deals are expected to close this quarter?' },
  { label: '🏭 Sector Strength', text: 'Which sector has the strongest pipeline?' },
  { label: '⚡ Energy Sector', text: 'How is our pipeline looking for the Renewables sector?' },
  { label: '🔧 Work Orders', text: 'How many work orders are delayed?' },
  { label: '🔀 Cross-Board', text: 'Which customers have both active deals and ongoing work orders?' },
  { label: '⚖️ Compare Sectors', text: 'Compare Mining and Powerline sectors' },
  { label: '🏆 Top Customers', text: 'Which customers have the largest open opportunities?' },
  { label: '📋 Leadership Update', text: 'Prepare a leadership update' },
  { label: '📈 Win Rate', text: 'What is our current win rate and revenue from won deals?' },
  { label: '🔍 Data Quality', text: 'How reliable is this data analysis?' },
  { label: '🔄 Operations', text: 'What is the overall work order completion rate?' },
]

export function SuggestedQuestions({ onSelect, disabled }: Props) {
  return (
    <div className="px-4 pb-3">
      <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
        Suggested questions
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q.text}
            onClick={() => onSelect(q.text)}
            disabled={disabled}
            className="text-xs bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}
