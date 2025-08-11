import React from 'react'
import Papa from 'papaparse'

export default function CSVTable({ csv }: { csv: string }) {
  const parsed = React.useMemo(() => Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true }), [csv])
  const rows = (parsed.data as unknown as string[][]) || []
  if (rows.length === 0) return <div className="text-sm text-gray-500">No rows</div>
  const [header, ...body] = rows
  return (
    <div className="overflow-auto border border-slate-700 rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-cyber-panel/60">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="text-left px-2 py-1 font-medium text-cyber-neonCyan border-b border-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="odd:bg-cyber-panel/20 even:bg-cyber-panel/40 hover:bg-cyber-panel/60">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1 border-b border-slate-800 align-top whitespace-pre-wrap text-gray-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 