import { useState, useEffect } from 'react';
import { Copy, Users, Video, FileUp, ArrowRight, User, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface LobbyProps {
  peerId: string;
  onInitialize: (id: string) => void;
  onJoin: (targetId: string) => void;
  error: string | null;
}

export function Lobby({ peerId, onInitialize, onJoin, error }: LobbyProps) {
  const [username, setUsername] = useState('');
  const [targetId, setTargetId] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastConnected, setLastConnected] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lastConnectedPeer');
    if (saved) setLastConnected(saved);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = (id: string) => {
    if (id.trim()) {
      localStorage.setItem('lastConnectedPeer', id.trim());
      onJoin(id.trim());
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-3 text-white">esharenp</h1>
            <p className="text-neutral-400 text-lg">Peer-to-peer file sharing & communication</p>
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {!peerId ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Choose a Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-neutral-500" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="e.g. bishnu-123"
                      className="w-full bg-neutral-950 border border-neutral-800 pl-11 pr-4 py-3.5 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Only lowercase letters, numbers, and hyphens.</p>
                </div>
                <button
                  onClick={() => username && onInitialize(username)}
                  disabled={!username || username.length < 3}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Host Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-neutral-300">Your Username</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3.5 rounded-xl text-sm font-mono text-blue-400 overflow-x-auto">
                      {peerId}
                    </code>
                    <button
                      onClick={handleCopy}
                      className={cn(
                        "p-3.5 rounded-xl transition-all flex-shrink-0 border",
                        copied 
                          ? "bg-green-500/10 border-green-500/20 text-green-400" 
                          : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      )}
                      title="Copy ID"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500">Share this username with your friend to connect.</p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-900 px-4 text-neutral-500 font-medium tracking-wider">Or connect to</span>
                  </div>
                </div>

                {/* Join Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-neutral-300">Friend's Username</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="Enter username..."
                      className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3.5 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                    <button
                      onClick={() => targetId && handleJoin(targetId)}
                      disabled={!targetId}
                      className="bg-white text-black hover:bg-neutral-200 px-6 py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Connect
                    </button>
                  </div>
                  {lastConnected && (
                    <div className="pt-2">
                      <button 
                        onClick={() => handleJoin(lastConnected)}
                        className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-900/50 border border-white/5 px-3 py-2 rounded-lg"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Connect to last: <span className="font-medium text-blue-400">{lastConnected}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center pt-4">
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs font-medium">File Transfer</span>
            </div>
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs font-medium">P2P Chat</span>
            </div>
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center justify-center">
                <Video className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs font-medium">Voice & Video</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 text-center z-10 border-t border-white/5 bg-neutral-950/50 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 space-y-3">
          <p className="text-sm text-neutral-400">
            Developed by <span className="text-white font-medium">Bishnu Gautam</span>
          </p>
          <p className="text-xs text-neutral-500">
            BE Computer Student at Pokhara University
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 mt-4">
            <span className="mr-2">Tech Stack:</span>
            <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">React</span>
            <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">WebRTC</span>
            <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">PeerJS</span>
            <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">Tailwind CSS</span>
            <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
