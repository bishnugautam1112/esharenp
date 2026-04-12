import { useState } from 'react';
import { Copy, Users, Video, FileUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface LobbyProps {
  peerId: string;
  onJoin: (targetId: string) => void;
}

export function Lobby({ peerId, onJoin }: LobbyProps) {
  const [targetId, setTargetId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">esharenp</h1>
          <p className="text-neutral-400">Peer-to-peer file sharing & communication</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6 shadow-xl">
          {/* Host Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-300">Your Connection ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 rounded-xl text-sm font-mono text-neutral-200 overflow-x-auto">
                {peerId || 'Generating...'}
              </code>
              <button
                onClick={handleCopy}
                disabled={!peerId}
                className={cn(
                  "p-3 rounded-xl transition-colors flex-shrink-0",
                  copied ? "bg-green-500/10 text-green-500" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                )}
                title="Copy ID"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">Share this ID with someone to let them connect to you.</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-900 px-2 text-neutral-500 font-medium">Or join someone</span>
            </div>
          </div>

          {/* Join Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-300">Connect to Peer</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Enter Peer ID..."
                className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={() => targetId && onJoin(targetId)}
                disabled={!targetId}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center pt-8">
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
              <FileUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">File Transfer</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">P2P Chat</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Voice & Video</span>
          </div>
        </div>
      </div>
    </div>
  );
}
