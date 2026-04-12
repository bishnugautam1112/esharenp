import { useState, useEffect, useRef } from 'react';
import { Send, File, Download, Video, VideoOff, PhoneOff, FileUp, MonitorUp, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { PeerState } from '../lib/usePeer';

interface RoomProps {
  peerState: PeerState;
  targetId: string | null;
  onLeave: () => void;
  onCall: (id: string, video: boolean, audio: boolean) => void;
  onEndCall: () => void;
  onShareScreen: () => void;
}

type Message = {
  id: string;
  sender: 'me' | 'peer';
  text?: string;
  file?: { name: string; size: number; url: string; type: string };
  timestamp: number;
};

type FileTransfer = {
  id: string;
  name: string;
  size: number;
  progress: number;
  direction: 'sending' | 'receiving';
  chunks?: ArrayBuffer[];
  completed?: boolean;
  type: string;
};

export function Room({ peerState, targetId, onLeave, onCall, onEndCall, onShareScreen }: RoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [transfers, setTransfers] = useState<Record<string, FileTransfer>>({});
  const [screenShareRequest, setScreenShareRequest] = useState(false);
  
  const activeConnection = peerState.connections[0];
  const connectedPeerId = activeConnection?.peer || targetId;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localVideoRef.current && peerState.localStream) {
      localVideoRef.current.srcObject = peerState.localStream;
    }
  }, [peerState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && peerState.remoteStream) {
      remoteVideoRef.current.srcObject = peerState.remoteStream;
    }
  }, [peerState.remoteStream]);

  useEffect(() => {
    if (!activeConnection) return;

    const handleData = (data: any) => {
      if (data.type === 'text') {
        setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'peer', text: data.content, timestamp: Date.now() }]);
      } else if (data.type === 'file-start') {
        setTransfers(prev => ({ 
          ...prev, 
          [data.id]: { id: data.id, name: data.name, size: data.size, type: data.fileType, progress: 0, direction: 'receiving', chunks: [] } 
        }));
      } else if (data.type === 'file-chunk') {
        setTransfers(prev => {
          const t = prev[data.id];
          if (!t) return prev;
          const newChunks = [...(t.chunks || []), data.chunk];
          const receivedSize = newChunks.reduce((acc, c) => acc + c.byteLength, 0);
          return { ...prev, [data.id]: { ...t, chunks: newChunks, progress: Math.min((receivedSize / t.size) * 100, 100) } };
        });
      } else if (data.type === 'file-end') {
        setTransfers(prev => {
          const t = prev[data.id];
          if (!t || !t.chunks) return prev;
          const blob = new Blob(t.chunks, { type: t.type });
          const url = URL.createObjectURL(blob);
          
          setMessages(m => [...m, { id: data.id, sender: 'peer', file: { name: t.name, size: t.size, url, type: t.type }, timestamp: Date.now() }]);
          
          return { ...prev, [data.id]: { ...t, completed: true, progress: 100, chunks: [] } };
        });
      } else if (data.type === 'request-screen-share') {
        setScreenShareRequest(true);
      }
    };

    activeConnection.on('data', handleData);
    return () => {
      activeConnection.off('data', handleData);
    };
  }, [activeConnection]);

  const sendMessage = () => {
    if (!input.trim() || !activeConnection) return;
    
    const text = input.trim();
    setInput('');

    activeConnection.send({ type: 'text', content: text });
    setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'me', text, timestamp: Date.now() }]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConnection) return;

    const id = Math.random().toString(36).substring(7);
    setTransfers(prev => ({ ...prev, [id]: { id, name: file.name, size: file.size, type: file.type, progress: 0, direction: 'sending' } }));

    activeConnection.send({ type: 'file-start', id, name: file.name, size: file.size, fileType: file.type });

    const CHUNK_SIZE = 64 * 1024; // 64KB chunks
    let offset = 0;

    const readChunk = (offset: number, size: number): Promise<ArrayBuffer> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.readAsArrayBuffer(file.slice(offset, offset + size));
      });
    };

    while (offset < file.size) {
      const chunk = await readChunk(offset, CHUNK_SIZE);
      activeConnection.send({ type: 'file-chunk', id, chunk });
      offset += CHUNK_SIZE;
      setTransfers(prev => ({ ...prev, [id]: { ...prev[id], progress: Math.min((offset / file.size) * 100, 100) } }));
      await new Promise(r => setTimeout(r, 10)); // Prevent buffer overflow
    }

    activeConnection.send({ type: 'file-end', id });
    
    const url = URL.createObjectURL(file);
    setMessages(m => [...m, { id, sender: 'me', file: { name: file.name, size: file.size, url, type: file.type }, timestamp: Date.now() }]);
    setTransfers(prev => ({ ...prev, [id]: { ...prev[id], completed: true, progress: 100 } }));
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const requestScreenShare = () => {
    if (activeConnection) {
      activeConnection.send({ type: 'request-screen-share' });
      alert("Screen share request sent!");
    }
  };

  const acceptScreenShare = async () => {
    setScreenShareRequest(false);
    if (!peerState.mediaConnection) {
       // If not in a call, start one first
       if (connectedPeerId) {
         await onCall(connectedPeerId, true, true);
         // Wait a moment for connection to establish before sharing screen
         setTimeout(() => onShareScreen(), 1000);
       }
    } else {
       onShareScreen();
    }
  };

  return (
    <div className="h-screen bg-neutral-950 text-neutral-50 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Screen Share Request Toast */}
      {screenShareRequest && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-blue-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <MonitorUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-sm">Screen Share Request</p>
            <p className="text-xs text-neutral-400">{connectedPeerId} wants to see your screen.</p>
          </div>
          <div className="flex gap-2 ml-4">
            <button onClick={acceptScreenShare} className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setScreenShareRequest(false)} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content (Video Area) */}
      <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-neutral-800 h-[50vh] md:h-auto">
        {/* Header */}
        <div className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 md:px-6 bg-neutral-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px]", activeConnection ? "bg-green-500 shadow-green-500/50" : "bg-yellow-500 shadow-yellow-500/50")} />
            <span className="font-medium text-sm">
              {activeConnection ? `Connected to ${connectedPeerId}` : 'Waiting for connection...'}
            </span>
          </div>
          <button onClick={onLeave} className="text-sm px-4 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg font-medium transition-colors">
            Disconnect
          </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto bg-neutral-950/50">
          {peerState.mediaConnection || peerState.localStream ? (
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 shadow-xl">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                  You {peerState.isScreenSharing && <span className="text-blue-400">(Screen)</span>}
                </div>
              </div>
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 shadow-xl flex items-center justify-center">
                {peerState.remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="text-neutral-500 flex flex-col items-center gap-2">
                    <VideoOff className="w-8 h-8 opacity-50" />
                    <span className="text-sm font-medium">Waiting for video...</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium">
                  {connectedPeerId}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 m-4">
              <div className="text-center space-y-5">
                <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                  <Video className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white">Start a Call</h3>
                  <p className="text-sm text-neutral-400 mt-1">Connect with voice and video</p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button 
                    onClick={() => connectedPeerId && onCall(connectedPeerId, true, true)}
                    disabled={!activeConnection}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                  >
                    Video Call
                  </button>
                  <button 
                    onClick={() => connectedPeerId && onCall(connectedPeerId, false, true)}
                    disabled={!activeConnection}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    Voice Only
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Call Controls */}
          {(peerState.mediaConnection || peerState.localStream) && (
            <div className="flex justify-center gap-4 py-2">
              <button 
                onClick={peerState.isScreenSharing ? () => {} : onShareScreen} 
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-white transition-all shadow-lg",
                  peerState.isScreenSharing ? "bg-blue-500 shadow-blue-500/20" : "bg-neutral-800 hover:bg-neutral-700"
                )}
                title={peerState.isScreenSharing ? "Sharing Screen" : "Share Screen"}
              >
                <MonitorUp className="w-5 h-5" />
              </button>
              <button onClick={onEndCall} className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all shadow-lg shadow-red-500/20">
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar (Chat & Transfers) */}
      <div className="w-full md:w-96 flex flex-col bg-neutral-900/30 h-[50vh] md:h-auto">
        <div className="h-16 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/50 backdrop-blur-md">
          <h2 className="font-medium text-white">Chat & Files</h2>
          <button 
            onClick={requestScreenShare}
            disabled={!activeConnection}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <MonitorUp className="w-3.5 h-3.5" /> Request Screen
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Transfers */}
          {Object.values(transfers).filter(t => !t.completed).map(t => (
            <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-neutral-300 truncate max-w-[200px]">{t.name}</span>
                <span className="text-neutral-500">{t.direction === 'sending' ? 'Sending...' : 'Receiving...'}</span>
              </div>
              <div className="h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", t.direction === 'sending' ? "bg-blue-500" : "bg-green-500")}
                  style={{ width: `${t.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>{Math.round(t.progress)}%</span>
                <span>{(t.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
          ))}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex flex-col max-w-[85%]", msg.sender === 'me' ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className={cn(
                "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                msg.sender === 'me' ? "bg-blue-600 text-white rounded-br-sm" : "bg-neutral-800 text-neutral-100 rounded-bl-sm border border-white/5"
              )}>
                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                {msg.file && (
                  <div className="flex items-center gap-3 bg-black/20 p-2.5 rounded-xl mt-1 border border-white/5">
                    <div className="w-10 h-10 bg-black/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <File className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{msg.file.name}</p>
                      <p className="text-xs opacity-70">{(msg.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <a 
                      href={msg.file.url} 
                      download={msg.file.name}
                      className="p-2 hover:bg-black/20 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 bg-neutral-900 border-t border-neutral-800">
          <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeConnection}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <FileUp className="w-5 h-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message peer..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[44px] transition-all"
              rows={1}
            />
            <button 
              onClick={sendMessage}
              disabled={!input.trim() || !activeConnection}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 flex-shrink-0 shadow-lg shadow-blue-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
