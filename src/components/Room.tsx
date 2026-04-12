import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Send, File, Download, Video, VideoOff, PhoneOff, FileUp, MonitorUp, X, Maximize, Minimize, Mic, MicOff, Camera, CameraOff, FileVideo, Link } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePeer } from '../lib/usePeer';

interface RoomProps {
  peerState: ReturnType<typeof usePeer>;
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
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showAdvancedCall, setShowAdvancedCall] = useState(false);
  
  const [isWatchHost, setIsWatchHost] = useState(false);
  const [isWatchClient, setIsWatchClient] = useState(false);
  const [screenZoom, setScreenZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showWatchMenu, setShowWatchMenu] = useState(false);
  const [watchUrlInput, setWatchUrlInput] = useState('');
  const [watchUrl, setWatchUrl] = useState<string | null>(null);

  useEffect(() => {
    if (screenZoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [screenZoom]);
  
  const cancelledTransfersRef = useRef<Set<string>>(new Set());
  const activeConnection = peerState.connections[0];
  const connectedPeerId = activeConnection?.peer || targetId;

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchTogetherInputRef = useRef<HTMLInputElement>(null);
  
  const sharedVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const localSecondaryVideoRef = useRef<HTMLVideoElement>(null);

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
    if (secondaryVideoRef.current && peerState.remoteSecondaryStream) {
      secondaryVideoRef.current.srcObject = peerState.remoteSecondaryStream;
    }
    if (!peerState.remoteSecondaryStream) {
      setIsWatchClient(false);
      setScreenZoom(1);
    }
  }, [peerState.remoteSecondaryStream]);

  useEffect(() => {
    if (localSecondaryVideoRef.current && peerState.localSecondaryStream) {
      localSecondaryVideoRef.current.srcObject = peerState.localSecondaryStream;
    }
  }, [peerState.localSecondaryStream]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (isMuted) {
          peerState.toggleAudio(false);
          setIsMuted(false);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted(prev => {
          peerState.toggleAudio(!prev);
          return !prev;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        peerState.toggleAudio(true);
        setIsMuted(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMuted, peerState]);

  const togglePiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(console.error);
    } else if (remoteVideoRef.current) {
      await remoteVideoRef.current.requestPictureInPicture().catch(console.error);
    }
  };

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
      } else if (data.type === 'file-cancel') {
        setTransfers(prev => {
          const newTransfers = { ...prev };
          delete newTransfers[data.id];
          return newTransfers;
        });
      } else if (data.type === 'watch-start') {
        setIsWatchClient(true);
      } else if (data.type === 'watch-start-url') {
        setWatchUrl(data.url);
        setIsWatchClient(true);
      } else if (data.type === 'watch-stop') {
        setIsWatchClient(false);
        setWatchUrl(null);
      } else if (data.type === 'watch-stop-request') {
        if (isWatchHost) stopWatchTogether();
      } else if (data.type === 'watch-control') {
        if (isWatchHost) {
          if (sharedVideoRef.current) {
            const v = sharedVideoRef.current;
            if (data.action === 'togglePlay') v.paused ? v.play() : v.pause();
            else if (data.action === 'seek') v.currentTime += data.value;
            else if (data.action === 'speed') v.playbackRate = data.value;
          }
          if (watchUrl) {
            activeConnection?.send({ type: 'watch-control', action: data.action, value: data.value });
          }
        } else if (isWatchClient && watchUrl) {
          if (sharedVideoRef.current) {
            const v = sharedVideoRef.current;
            if (data.action === 'togglePlay') v.paused ? v.play() : v.pause();
            else if (data.action === 'seek') v.currentTime += data.value;
            else if (data.action === 'speed') v.playbackRate = data.value;
          }
        }
      }
    };

    activeConnection.on('data', handleData);
    return () => {
      activeConnection.off('data', handleData);
    };
  }, [activeConnection]);

  const cancelTransfer = (id: string) => {
    cancelledTransfersRef.current.add(id);
    if (activeConnection) {
      activeConnection.send({ type: 'file-cancel', id });
    }
    setTransfers(prev => {
      const newTransfers = { ...prev };
      delete newTransfers[id];
      return newTransfers;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && !attachedFile) return;
    if (!activeConnection) return;
    
    if (input.trim()) {
      activeConnection.send({ type: 'text', content: input.trim() });
      setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'me', text: input.trim(), timestamp: Date.now() }]);
    }

    if (attachedFile) {
      const file = attachedFile;
      setAttachedFile(null); // Clear immediately
      
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
        if (cancelledTransfersRef.current.has(id)) {
          cancelledTransfersRef.current.delete(id);
          return; // Stop sending
        }
        
        const chunk = await readChunk(offset, CHUNK_SIZE);
        activeConnection.send({ type: 'file-chunk', id, chunk });
        offset += CHUNK_SIZE;
        setTransfers(prev => {
          if (!prev[id]) return prev; // Was cancelled
          return { ...prev, [id]: { ...prev[id], progress: Math.min((offset / file.size) * 100, 100) } };
        });
        await new Promise(r => setTimeout(r, 10)); // Prevent buffer overflow
      }

      if (cancelledTransfersRef.current.has(id)) {
        cancelledTransfersRef.current.delete(id);
        return;
      }

      activeConnection.send({ type: 'file-end', id });
      
      const url = URL.createObjectURL(file);
      setMessages(m => [...m, { id, sender: 'me', file: { name: file.name, size: file.size, url, type: file.type }, timestamp: Date.now() }]);
      setTransfers(prev => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], completed: true, progress: 100 } };
      });
    }
    
    setInput('');
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendWatchControl = (action: string, value?: number) => {
    if (isWatchHost) {
      if (sharedVideoRef.current) {
        const v = sharedVideoRef.current;
        if (action === 'togglePlay') v.paused ? v.play() : v.pause();
        if (action === 'seek') v.currentTime += value!;
        if (action === 'speed') v.playbackRate = value!;
      }
      if (watchUrl) {
        activeConnection?.send({ type: 'watch-control', action, value });
      }
    } else if (isWatchClient) {
      activeConnection?.send({ type: 'watch-control', action, value });
    }
  };

  const startLocalWatch = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && sharedVideoRef.current) {
      const url = URL.createObjectURL(file);
      sharedVideoRef.current.src = url;
      sharedVideoRef.current.play().then(() => {
        const videoElement = sharedVideoRef.current as any;
        const stream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream ? videoElement.mozCaptureStream() : null;
        if (stream) {
          peerState.startSecondaryStream(stream);
          activeConnection?.send({ type: 'watch-start' });
          setIsWatchHost(true);
        } else {
          console.error("captureStream not supported");
        }
      }).catch(console.error);
    }
    if (watchTogetherInputRef.current) watchTogetherInputRef.current.value = '';
    setShowWatchMenu(false);
  };

  const startOnlineWatch = () => {
    if (!watchUrlInput) return;
    setWatchUrl(watchUrlInput);
    setIsWatchHost(true);
    setShowWatchMenu(false);
    activeConnection?.send({ type: 'watch-start-url', url: watchUrlInput });
  };

  const stopWatchTogether = () => {
    if (isWatchHost) {
      if (watchUrl) {
        activeConnection?.send({ type: 'watch-stop' });
      } else {
        peerState.stopSecondaryStream();
        activeConnection?.send({ type: 'watch-stop' });
      }
      setIsWatchHost(false);
      setWatchUrl(null);
      if (sharedVideoRef.current) {
        sharedVideoRef.current.pause();
        sharedVideoRef.current.src = '';
      }
    } else if (isWatchClient) {
      activeConnection?.send({ type: 'watch-stop-request' });
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await videoContainerRef.current?.requestFullscreen().catch(console.error);
    } else {
      await document.exitFullscreen().catch(console.error);
    }
  };

  const hasSecondary = peerState.localSecondaryStream || peerState.remoteSecondaryStream || isWatchHost || watchUrl || peerState.isScreenSharing;

  return (
    <div className="h-screen bg-neutral-950 text-neutral-50 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Main Content (Video Area) */}
      <div ref={videoContainerRef} className={cn("flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-neutral-800 relative", isFullscreen ? "bg-black" : "bg-neutral-950/50 h-[50vh] md:h-auto")}>
        {/* Header Overlay */}
        {!isFullscreen && !hasSecondary && (
          <div className="absolute top-0 left-0 right-0 h-20 flex items-start justify-between px-4 md:px-6 pt-4 bg-gradient-to-b from-black/80 to-transparent z-30 pointer-events-none">
            <div className="flex items-center gap-3 pointer-events-auto">
              <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px]", activeConnection ? "bg-green-500 shadow-green-500/50" : "bg-yellow-500 shadow-yellow-500/50")} />
              <span className="font-medium text-sm text-white drop-shadow-md">
                {activeConnection ? `Connected to ${connectedPeerId}` : 'Waiting for connection...'}
              </span>
            </div>
            <button onClick={onLeave} className="pointer-events-auto text-sm px-4 py-1.5 bg-red-500/80 text-white hover:bg-red-500 rounded-lg font-medium transition-colors shadow-lg backdrop-blur-md">
              Disconnect
            </button>
          </div>
        )}

        {/* Video Area */}
        <div className={cn("flex-1 flex flex-col overflow-hidden relative bg-black", isFullscreen ? "p-0" : "")}>
          {peerState.mediaConnection || peerState.localStream ? (
            <div className="relative w-full h-full">
              {/* MAIN AREA */}
              {hasSecondary ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
                   {watchUrl ? (
                     <video ref={sharedVideoRef} src={watchUrl} autoPlay className="w-full h-full object-contain" controls={false} />
                   ) : isWatchHost ? (
                     <video ref={sharedVideoRef} className="w-full h-full object-contain" controls={false} />
                   ) : peerState.remoteSecondaryStream ? (
                     <video ref={secondaryVideoRef} autoPlay playsInline className="w-full h-full object-contain transition-transform duration-200" style={{ transform: `scale(${screenZoom}) translate(${pan.x}px, ${pan.y}px)` }} />
                   ) : peerState.localSecondaryStream ? (
                     <video ref={localSecondaryVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
                   ) : null}

                   {/* Zoom controls for remote screen share */}
                   {peerState.remoteSecondaryStream && !isWatchClient && (
                     <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
                       <div className="flex justify-center gap-2">
                         <button onClick={() => setScreenZoom(z => z + 0.2)} className="bg-black/60 hover:bg-black/80 w-10 h-10 flex items-center justify-center rounded-lg text-white backdrop-blur-md transition-all font-bold text-xl">+</button>
                         <button onClick={() => setScreenZoom(z => Math.max(1, z - 0.2))} className="bg-black/60 hover:bg-black/80 w-10 h-10 flex items-center justify-center rounded-lg text-white backdrop-blur-md transition-all font-bold text-xl">-</button>
                       </div>
                       {screenZoom > 1 && (
                         <div className="grid grid-cols-3 gap-1 mt-2">
                           <div />
                           <button onClick={() => setPan(p => ({ ...p, y: p.y + 50 }))} className="bg-black/60 hover:bg-black/80 p-2 rounded-lg text-white flex items-center justify-center">↑</button>
                           <div />
                           <button onClick={() => setPan(p => ({ ...p, x: p.x + 50 }))} className="bg-black/60 hover:bg-black/80 p-2 rounded-lg text-white flex items-center justify-center">←</button>
                           <button onClick={() => setPan(p => ({ ...p, y: p.y - 50 }))} className="bg-black/60 hover:bg-black/80 p-2 rounded-lg text-white flex items-center justify-center">↓</button>
                           <button onClick={() => setPan(p => ({ ...p, x: p.x - 50 }))} className="bg-black/60 hover:bg-black/80 p-2 rounded-lg text-white flex items-center justify-center">→</button>
                         </div>
                       )}
                     </div>
                   )}

                   {/* Watch Together Controls */}
                   {(isWatchHost || isWatchClient) && (
                     <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl z-50 border border-white/10">
                       <button onClick={() => sendWatchControl('seek', -10)} className="text-white hover:text-blue-400">-10s</button>
                       <button onClick={() => sendWatchControl('togglePlay')} className="text-white hover:text-blue-400 font-medium px-4">Play / Pause</button>
                       <button onClick={() => sendWatchControl('seek', 10)} className="text-white hover:text-blue-400">+10s</button>
                       <div className="w-px h-6 bg-white/20 mx-2" />
                       <select onChange={(e) => sendWatchControl('speed', parseFloat(e.target.value))} className="bg-transparent text-white outline-none cursor-pointer">
                         <option value="1" className="text-black">1x Speed</option>
                         <option value="1.5" className="text-black">1.5x Speed</option>
                         <option value="2" className="text-black">2x Speed</option>
                       </select>
                       <div className="w-px h-6 bg-white/20 mx-2" />
                       <button onClick={stopWatchTogether} className="text-red-400 hover:text-red-300 font-medium">Stop Watch</button>
                     </div>
                   )}
                </div>
              ) : (
                /* Normal Remote Video */
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  {peerState.remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-neutral-500 flex flex-col items-center gap-2">
                      <VideoOff className="w-12 h-12 opacity-50" />
                      <span className="text-lg font-medium">Waiting for video...</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium z-10 text-white">
                    {connectedPeerId}
                  </div>
                </div>
              )}

              {/* FLOATING CAMERAS */}
              <div className="absolute bottom-24 md:bottom-24 right-4 flex flex-col md:flex-row items-end gap-3 z-20 pointer-events-none">
                {hasSecondary && peerState.remoteStream && (
                  <div className="w-24 md:w-32 aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative pointer-events-auto">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white">Peer</div>
                  </div>
                )}
                <div className={cn("bg-neutral-900 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative pointer-events-auto", hasSecondary ? "w-24 md:w-32 aspect-video" : "w-32 md:w-48 aspect-[3/4] md:aspect-video")}>
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1.5 text-white">
                    You {peerState.isScreenSharing && <span className="text-blue-400">(Screen)</span>}
                    {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>
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
                <div className="pt-4">
                  <button 
                    onClick={() => setShowAdvancedCall(!showAdvancedCall)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    {showAdvancedCall ? 'Hide Advanced Options' : 'Show Advanced Options'}
                  </button>
                  {showAdvancedCall && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button onClick={() => connectedPeerId && peerState.callPeer(connectedPeerId, { video: { width: 640, height: 480, frameRate: 15 }, audio: true })} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs border border-green-500/30 text-green-400">Stable Super Mode</button>
                      <button onClick={() => connectedPeerId && peerState.callPeer(connectedPeerId, { video: true, audio: true, resolution: '720p' })} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs">720p Call</button>
                      <button onClick={() => connectedPeerId && peerState.callPeer(connectedPeerId, { video: true, audio: true, resolution: '1080p' })} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs">1080p Call</button>
                      <button onClick={() => connectedPeerId && peerState.callPeer(connectedPeerId, { video: true, audio: true, facingMode: 'environment' })} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs">Back Camera</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Call Controls Overlay */}
          {(peerState.mediaConnection || peerState.localStream) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 bg-neutral-900/90 backdrop-blur-md px-4 md:px-6 py-3 rounded-2xl border border-white/10 shadow-2xl z-50">
              <button 
                onClick={() => {
                  setIsMuted(!isMuted);
                  peerState.toggleAudio(!isMuted);
                }}
                onPointerDown={() => { if (isMuted) peerState.toggleAudio(false); }}
                onPointerUp={() => { if (isMuted) peerState.toggleAudio(true); }}
                onPointerLeave={() => { if (isMuted) peerState.toggleAudio(true); }}
                className={cn("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all", isMuted ? "bg-red-500/20 text-red-400" : "bg-neutral-800 text-white hover:bg-neutral-700")}
                title={isMuted ? "Unmute (Hold Space to talk)" : "Mute (Press M)"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button 
                onClick={() => {
                  setIsVideoOff(!isVideoOff);
                  peerState.toggleVideo(!isVideoOff);
                }}
                className={cn("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all", isVideoOff ? "bg-red-500/20 text-red-400" : "bg-neutral-800 text-white hover:bg-neutral-700")}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
              >
                {isVideoOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </button>

              <button 
                onClick={() => {
                  const newMode = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(newMode);
                  peerState.switchCamera(newMode);
                }}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 transition-all"
                title="Switch Camera"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
              </button>

              <button 
                onClick={peerState.isScreenSharing ? peerState.stopScreenShare : onShareScreen} 
                className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all",
                  peerState.isScreenSharing ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-neutral-800 text-white hover:bg-neutral-700"
                )}
                title={peerState.isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              >
                <MonitorUp className="w-5 h-5" />
              </button>

              <button 
                onClick={toggleFullscreen}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 transition-all"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>

              <button 
                onClick={togglePiP}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 transition-all"
                title="Picture in Picture"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><rect width="8" height="5" x="11" y="12" rx="1" ry="1"/></svg>
              </button>

              <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />

              <button 
                onClick={onEndCall} 
                className="w-10 h-10 md:w-12 md:h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all shadow-lg shadow-red-500/20"
                title="End Call"
              >
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
          <div className="flex items-center gap-2 relative">
            <input type="file" accept="video/*" ref={watchTogetherInputRef} onChange={startLocalWatch} className="hidden" />
            <button 
              onClick={() => setShowWatchMenu(!showWatchMenu)}
              disabled={!activeConnection}
              className="text-xs px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg font-medium transition-colors disabled:opacity-50"
              title="Watch a video together"
            >
              Watch Together
            </button>
            {showWatchMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl z-50 p-3 flex flex-col gap-3">
                <button 
                  onClick={() => watchTogetherInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-white hover:bg-neutral-700 p-2 rounded-lg transition-colors text-left"
                >
                  <FileVideo className="w-4 h-4" /> Local Video File
                </button>
                <div className="h-px bg-neutral-700 w-full" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-white px-2">
                    <Link className="w-4 h-4" /> Online URL (mp4/webm)
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={watchUrlInput}
                      onChange={(e) => setWatchUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <button onClick={startOnlineWatch} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Play</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Transfers */}
          {(Object.values(transfers) as FileTransfer[]).filter(t => !t.completed).map(t => (
            <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-neutral-300 truncate max-w-[150px]">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">{t.direction === 'sending' ? 'Sending...' : 'Receiving...'}</span>
                  {t.direction === 'sending' && (
                    <button onClick={() => cancelTransfer(t.id)} className="text-red-400 hover:text-red-300 p-1">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
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

        <div className="p-4 bg-neutral-900 border-t border-neutral-800 relative">
          {/* Attached File Staging Area */}
          {attachedFile && (
            <div className="absolute bottom-full left-0 mb-2 w-full px-4">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-white truncate">{attachedFile.name}</p>
                    <p className="text-xs text-neutral-400">{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setAttachedFile(null)} className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
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
              disabled={(!input.trim() && !attachedFile) || !activeConnection}
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
