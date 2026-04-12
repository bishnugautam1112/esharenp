import { useState, useEffect, useRef } from 'react';
import { DataConnection } from 'peerjs';
import { Send, File, Download, Search, BrainCircuit, X, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { PeerState } from '../lib/usePeer';

interface RoomProps {
  peerState: PeerState;
  targetId: string | null;
  onLeave: () => void;
  onCall: (id: string, video: boolean, audio: boolean) => void;
  onEndCall: () => void;
}

type Message = {
  id: string;
  sender: 'me' | 'peer' | 'ai';
  text?: string;
  file?: { name: string; size: number; data: ArrayBuffer; type: string };
  timestamp: number;
};

export function Room({ peerState, targetId, onLeave, onCall, onEndCall }: RoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiMode, setAiMode] = useState<'none' | 'thinking' | 'search'>('none');
  const [isAiTyping, setIsAiTyping] = useState(false);
  
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
      } else if (data.type === 'file') {
        setMessages(prev => [...prev, { 
          id: Math.random().toString(), 
          sender: 'peer', 
          file: { name: data.name, size: data.size, data: data.file, type: data.fileType },
          timestamp: Date.now() 
        }]);
      }
    };

    activeConnection.on('data', handleData);
    return () => {
      activeConnection.off('data', handleData);
    };
  }, [activeConnection]);

  const sendMessage = () => {
    if (!input.trim() && aiMode === 'none') return;
    
    const text = input.trim();
    setInput('');

    if (aiMode !== 'none') {
      // Send to AI
      setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'me', text, timestamp: Date.now() }]);
      handleAiQuery(text);
    } else if (activeConnection && text) {
      // Send to Peer
      activeConnection.send({ type: 'text', content: text });
      setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'me', text, timestamp: Date.now() }]);
    }
  };

  const handleAiQuery = async (query: string) => {
    setIsAiTyping(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ text: query }] }],
          mode: aiMode
        })
      });
      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'ai', text: data.text, timestamp: Date.now() }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'ai', text: 'Error connecting to AI.', timestamp: Date.now() }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConnection) return;

    // For simplicity in this demo, we send the file as an ArrayBuffer directly.
    // In a production app, you'd chunk it for files > 16MB (WebRTC limit).
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      activeConnection.send({
        type: 'file',
        name: file.name,
        size: file.size,
        fileType: file.type,
        file: arrayBuffer
      });
      setMessages(prev => [...prev, { 
        id: Math.random().toString(), 
        sender: 'me', 
        file: { name: file.name, size: file.size, data: arrayBuffer, type: file.type },
        timestamp: Date.now() 
      }]);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadFile = (fileData: ArrayBuffer, name: string, type: string) => {
    const blob = new Blob([fileData], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen bg-neutral-950 text-neutral-50 flex overflow-hidden font-sans">
      {/* Main Content (Video & File Transfer) */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-800">
        {/* Header */}
        <div className="h-16 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className={cn("w-2.5 h-2.5 rounded-full", activeConnection ? "bg-green-500" : "bg-yellow-500")} />
            <span className="font-medium text-sm">
              {activeConnection ? `Connected to ${connectedPeerId}` : 'Waiting for connection...'}
            </span>
          </div>
          <button onClick={onLeave} className="text-sm text-red-400 hover:text-red-300 font-medium">
            Disconnect
          </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          {peerState.mediaConnection || peerState.localStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full max-h-[60vh]">
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium">You</div>
              </div>
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
                {peerState.remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="text-neutral-500 flex flex-col items-center gap-2">
                    <VideoOff className="w-8 h-8" />
                    <span className="text-sm">Waiting for remote video...</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium">Peer</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Start a Call</h3>
                  <p className="text-sm text-neutral-400 mt-1">Connect with voice and video</p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button 
                    onClick={() => connectedPeerId && onCall(connectedPeerId, true, true)}
                    disabled={!activeConnection}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Video Call
                  </button>
                  <button 
                    onClick={() => connectedPeerId && onCall(connectedPeerId, false, true)}
                    disabled={!activeConnection}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Voice Only
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Call Controls */}
          {(peerState.mediaConnection || peerState.localStream) && (
            <div className="flex justify-center gap-4 py-4">
              <button onClick={onEndCall} className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/20">
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar (Chat & AI) */}
      <div className="w-96 flex flex-col bg-neutral-900/50">
        <div className="h-16 border-b border-neutral-800 flex items-center px-4 gap-2">
          <button 
            onClick={() => setAiMode('none')}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1", aiMode === 'none' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200")}
          >
            Peer Chat
          </button>
          <button 
            onClick={() => setAiMode('thinking')}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 flex items-center justify-center gap-1.5", aiMode === 'thinking' ? "bg-purple-500/20 text-purple-400" : "text-neutral-400 hover:text-neutral-200")}
          >
            <BrainCircuit className="w-4 h-4" /> Deep Think
          </button>
          <button 
            onClick={() => setAiMode('search')}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 flex items-center justify-center gap-1.5", aiMode === 'search' ? "bg-blue-500/20 text-blue-400" : "text-neutral-400 hover:text-neutral-200")}
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.filter(m => aiMode === 'none' ? (m.sender === 'me' || m.sender === 'peer') : (m.sender === 'me' || m.sender === 'ai')).map(msg => (
            <div key={msg.id} className={cn("flex flex-col max-w-[85%]", msg.sender === 'me' ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className={cn(
                "px-4 py-2.5 rounded-2xl text-sm",
                msg.sender === 'me' ? "bg-blue-600 text-white rounded-br-sm" : 
                msg.sender === 'ai' ? "bg-purple-900/50 border border-purple-500/30 text-purple-50 rounded-bl-sm" :
                "bg-neutral-800 text-neutral-100 rounded-bl-sm"
              )}>
                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                {msg.file && (
                  <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl mt-1">
                    <div className="w-10 h-10 bg-black/20 rounded-lg flex items-center justify-center">
                      <File className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{msg.file.name}</p>
                      <p className="text-xs opacity-70">{(msg.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {msg.sender === 'peer' && (
                      <button onClick={() => downloadFile(msg.file!.data, msg.file!.name, msg.file!.type)} className="p-2 hover:bg-black/20 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {isAiTyping && (
            <div className="mr-auto items-start flex flex-col max-w-[85%]">
              <div className="px-4 py-3 rounded-2xl bg-purple-900/30 border border-purple-500/20 rounded-bl-sm flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-neutral-900 border-t border-neutral-800">
          <div className="flex items-end gap-2">
            {aiMode === 'none' && (
              <>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!activeConnection}
                  className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <FileUp className="w-5 h-5" />
                </button>
              </>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={aiMode === 'none' ? "Message peer..." : `Ask AI (${aiMode})...`}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[44px]"
              rows={1}
            />
            <button 
              onClick={sendMessage}
              disabled={(!input.trim() && aiMode === 'none') || (aiMode === 'none' && !activeConnection)}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
