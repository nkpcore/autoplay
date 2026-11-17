import React, { useState } from 'react'
import type { RoomRules } from '../services/rooms'
import type { Cue } from '../data/types'

export interface PendingRequest {
  id: string
  cue: Cue
  guestId: string
  requestedAt: number
}

interface HostRulesModalProps {
  isOpen: boolean
  onClose: () => void
  rules: RoomRules
  onUpdateRules: (newRules: RoomRules) => void
  pendingRequests: PendingRequest[]
  onApproveRequest: (req: PendingRequest) => void
  onRejectRequest: (reqId: string) => void
  availableSubtypes: string[]
}

export const HostRulesModal: React.FC<HostRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  onUpdateRules,
  pendingRequests,
  onApproveRequest,
  onRejectRequest,
  availableSubtypes,
}) => {
  const [maxRequests, setMaxRequests] = useState(rules.maxRequestsPerGuest)
  const [approveAll, setApproveAll] = useState(rules.approveAll)
  const [vetoThreshold, setVetoThreshold] = useState(rules.vetoThreshold)
  const [cooldownSec, setCooldownSec] = useState(rules.cooldownSec)
  const [blockedSubtypes, setBlockedSubtypes] = useState<string[]>(rules.blockedSubtypes)

  if (!isOpen) return null

  const handleSave = () => {
    onUpdateRules({
      maxRequestsPerGuest: Math.max(1, maxRequests),
      approveAll,
      vetoThreshold: Math.max(1, vetoThreshold),
      cooldownSec: Math.max(0, cooldownSec),
      blockedSubtypes,
    })
    onClose()
  }

  const toggleBlockedSubtype = (sub: string) => {
    setBlockedSubtypes((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub],
    )
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Host Room Rules</h3>
            <p className="text-zinc-400 text-xs">Configure guest request permissions, limits, and vetoes.</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 bg-zinc-800 rounded-lg cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Pending Requests Queue (when approveAll is active or has pending items) */}
        {pendingRequests.length > 0 && (
          <div className="p-4 bg-purple-950/40 border border-purple-800/80 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-purple-300 uppercase tracking-wider">
                Pending Guest Approvals ({pendingRequests.length})
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <div className="font-bold text-white truncate">{req.cue.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{req.cue.artist}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onApproveRequest(req)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRejectRequest(req.id)}
                      className="px-2 py-1 bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white rounded cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rule Form Fields */}
        <div className="space-y-4 text-xs">
          {/* Max Requests per Guest */}
          <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div>
              <div className="font-bold text-white">Max Requests per Guest</div>
              <div className="text-zinc-500 text-[11px]">Concurrent active requests in queue per guest</div>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={maxRequests}
              onChange={(e) => setMaxRequests(parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-bold text-white"
            />
          </div>

          {/* Veto Skip Threshold */}
          <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div>
              <div className="font-bold text-white">Veto Threshold</div>
              <div className="text-zinc-500 text-[11px]">Number of unique guest votes to skip current track</div>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={vetoThreshold}
              onChange={(e) => setVetoThreshold(parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-bold text-white"
            />
          </div>

          {/* Request Cooldown */}
          <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div>
              <div className="font-bold text-white">Request Cooldown (seconds)</div>
              <div className="text-zinc-500 text-[11px]">Minimum wait time between requests by the same guest</div>
            </div>
            <input
              type="number"
              min={0}
              max={120}
              value={cooldownSec}
              onChange={(e) => setCooldownSec(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-bold text-white"
            />
          </div>

          {/* Approve All Toggle */}
          <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div>
              <div className="font-bold text-white">Require Host Approval</div>
              <div className="text-zinc-500 text-[11px]">Hold new guest requests in pending list until host approves</div>
            </div>
            <input
              type="checkbox"
              checked={approveAll}
              onChange={(e) => setApproveAll(e.target.checked)}
              className="accent-purple-500 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Blocked Subtypes */}
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
            <div>
              <div className="font-bold text-white">Blocked Subtypes / Genres</div>
              <div className="text-zinc-500 text-[11px]">Disallow requests matching specific genres (e.g. slow, romantic)</div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availableSubtypes.length === 0 ? (
                <div className="text-zinc-600 italic">No genres detected in catalog</div>
              ) : (
                availableSubtypes.map((sub) => {
                  const isBlocked = blockedSubtypes.includes(sub)
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleBlockedSubtype(sub)}
                      className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all cursor-pointer border ${
                        isBlocked
                          ? 'bg-red-950 border-red-700 text-red-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isBlocked ? `✕ ${sub}` : sub}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow cursor-pointer"
          >
            Save Rules
          </button>
        </div>
      </div>
    </div>
  )
}
export default HostRulesModal
