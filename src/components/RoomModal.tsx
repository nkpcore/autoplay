import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { showToast } from '../state/useToast'

interface RoomModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, roomId }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${roomId}` : ''

  useEffect(() => {
    if (isOpen && roomId) {
      QRCode.toDataURL(joinUrl, { margin: 1, width: 320, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err))
    }
  }, [isOpen, roomId, joinUrl])

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast(`Join URL:\n${joinUrl}`)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-5"
      >
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white tracking-tight">Guest Request Room</h3>
          <p className="text-zinc-400 text-xs">Scan or enter code to request &amp; vote on party songs.</p>
        </div>

        {/* QR Code Container */}
        <div className="w-64 h-64 mx-auto bg-white p-3 rounded-2xl shadow-inner flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code for room ${roomId}`} className="w-full h-full block" />
          ) : (
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Room Code Badge */}
        <div className="space-y-2">
          <div className="text-xs uppercase font-semibold text-zinc-500 tracking-wider">Room Code</div>
          <div className="inline-block px-5 py-2 rounded-xl bg-purple-950/80 border border-purple-600 text-purple-300 font-mono text-2xl font-black tracking-widest">
            {roomId}
          </div>
        </div>

        {/* Share Button */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            {copied ? 'Link Copied!' : 'Copy Guest Link'}
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
export default RoomModal
