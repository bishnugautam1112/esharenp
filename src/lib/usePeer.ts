import { useState, useRef, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

export type PeerState = {
  peer: Peer | null;
  peerId: string;
  connections: DataConnection[];
  mediaConnection: MediaConnection | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  secondaryConnection: MediaConnection | null;
  localSecondaryStream: MediaStream | null;
  remoteSecondaryStream: MediaStream | null;
  error: string | null;
  isScreenSharing: boolean;
};

export function usePeer() {
  const [state, setState] = useState<PeerState>({
    peer: null,
    peerId: '',
    connections: [],
    mediaConnection: null,
    remoteStream: null,
    localStream: null,
    secondaryConnection: null,
    localSecondaryStream: null,
    remoteSecondaryStream: null,
    error: null,
    isScreenSharing: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const initialize = useCallback((id: string) => {
    const newPeer = new Peer(id);

    newPeer.on('open', (openedId) => {
      setState((s) => ({ ...s, peer: newPeer, peerId: openedId, error: null }));
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
        setState((s) => ({ ...s, connections: [...s.connections, conn] }));
      });
      conn.on('close', () => {
        setState((s) => ({
          ...s,
          connections: s.connections.filter((c) => c.peer !== conn.peer),
        }));
      });
    });

    newPeer.on('call', (call) => {
      if (call.metadata?.type === 'secondary') {
        call.answer();
        setState((s) => ({ ...s, secondaryConnection: call }));
        call.on('stream', (remoteStream) => {
          setState((s) => ({ ...s, remoteSecondaryStream: remoteStream }));
        });
        call.on('close', () => {
          setState((s) => ({ ...s, remoteSecondaryStream: null, secondaryConnection: null }));
        });
        return;
      }

      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setState((s) => ({ ...s, localStream: stream, mediaConnection: call }));
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            setState((s) => ({ ...s, remoteStream }));
          });
          call.on('close', () => {
            setState((s) => ({ ...s, remoteStream: null, mediaConnection: null, isScreenSharing: false }));
          });
        })
        .catch((err) => {
          console.error('Failed to get local stream', err);
          call.answer();
          setState((s) => ({ ...s, mediaConnection: call }));
          call.on('stream', (remoteStream) => {
            setState((s) => ({ ...s, remoteStream }));
          });
        });
    });

    newPeer.on('error', (err) => {
      setState((s) => ({ ...s, error: err.message }));
    });

    return () => {
      newPeer.destroy();
    };
  }, []);

  const connectToPeer = (targetId: string) => {
    const { peer } = stateRef.current;
    if (!peer) return;

    const conn = peer.connect(targetId);
    conn.on('open', () => {
      setState((s) => ({ ...s, connections: [...s.connections, conn] }));
    });
    
    conn.on('close', () => {
      setState((s) => ({
        ...s,
        connections: s.connections.filter((c) => c.peer !== targetId),
      }));
    });

    return conn;
  };

  const callPeer = async (targetId: string, options: { video?: boolean, audio?: boolean, resolution?: 'default' | '720p' | '1080p', facingMode?: 'user' | 'environment' } = { video: true, audio: true }) => {
    const { peer } = stateRef.current;
    if (!peer) return;

    try {
      let videoConstraints: boolean | MediaTrackConstraints = options.video ?? true;
      
      if (options.video) {
        videoConstraints = {};
        if (options.facingMode) videoConstraints.facingMode = options.facingMode;
        if (options.resolution === '720p') {
          videoConstraints.width = { ideal: 1280 };
          videoConstraints.height = { ideal: 720 };
        } else if (options.resolution === '1080p') {
          videoConstraints.width = { ideal: 1920 };
          videoConstraints.height = { ideal: 1080 };
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: options.audio ?? true 
      });
      
      setState((s) => ({ ...s, localStream: stream }));

      const call = peer.call(targetId, stream);
      setState((s) => ({ ...s, mediaConnection: call }));

      call.on('stream', (remoteStream) => {
        setState((s) => ({ ...s, remoteStream }));
      });
      
      call.on('close', () => {
         setState((s) => ({ ...s, remoteStream: null, mediaConnection: null, isScreenSharing: false }));
      });
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  const switchCamera = async (facingMode: 'user' | 'environment') => {
    const { mediaConnection, localStream } = stateRef.current;
    if (!mediaConnection || !localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      
      if (sender) {
        sender.replaceTrack(newVideoTrack);
      }
      
      // Stop old tracks
      localStream.getTracks().forEach(track => track.stop());
      
      setState(s => ({ ...s, localStream: newStream }));
    } catch (err) {
      console.error("Failed to switch camera", err);
    }
  };

  const streamLocalMedia = (stream: MediaStream) => {
    const { mediaConnection, localStream } = stateRef.current;
    if (!mediaConnection) return;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      const sender = mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
    }
    
    if (audioTrack) {
      const sender = mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) sender.replaceTrack(audioTrack);
    }

    setState(s => ({ ...s, localStream: stream, isScreenSharing: true }));
  };

  const startSecondaryStream = (stream: MediaStream) => {
    const targetId = stateRef.current.connections[0]?.peer;
    const { peer } = stateRef.current;
    if (!targetId || !peer) return;

    const call = peer.call(targetId, stream, { metadata: { type: 'secondary' } });
    setState(s => ({ ...s, localSecondaryStream: stream, secondaryConnection: call }));

    call.on('close', () => {
      setState(s => ({ ...s, localSecondaryStream: null, secondaryConnection: null }));
      stream.getTracks().forEach(t => t.stop());
    });

    stream.getVideoTracks()[0].onended = () => {
      call.close();
      setState(s => ({ ...s, localSecondaryStream: null, secondaryConnection: null }));
    };
  };

  const stopSecondaryStream = () => {
    const { secondaryConnection, localSecondaryStream } = stateRef.current;
    if (secondaryConnection) secondaryConnection.close();
    if (localSecondaryStream) localSecondaryStream.getTracks().forEach(t => t.stop());
    setState(s => ({ ...s, localSecondaryStream: null, secondaryConnection: null }));
  };

  const shareScreen = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setState(s => ({ ...s, error: "Screen sharing is not supported on this device/browser." }));
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      startSecondaryStream(stream);
      setState(s => ({ ...s, isScreenSharing: true }));
      
      const videoTrack = stateRef.current.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.applyConstraints({ width: 320, height: 240, frameRate: 15 }).catch(console.error);
      }
      
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      setState(s => ({ ...s, error: err.message || "Failed to share screen." }));
    }
  };

  const stopScreenShare = () => {
    stopSecondaryStream();
    setState(s => ({ ...s, isScreenSharing: false }));
    
    const videoTrack = stateRef.current.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }).catch(console.error);
    }
  };

  const endCall = () => {
    const { mediaConnection, localStream } = stateRef.current;
    if (mediaConnection) {
      mediaConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setState(s => ({ ...s, mediaConnection: null, localStream: null, remoteStream: null, isScreenSharing: false }));
  };

  const toggleAudio = (muted: boolean) => {
    if (stateRef.current.localStream) {
      stateRef.current.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  };

  const toggleVideo = (videoOff: boolean) => {
    if (stateRef.current.localStream) {
      stateRef.current.localStream.getVideoTracks().forEach(track => {
        track.enabled = !videoOff;
      });
    }
  };

  const clearError = () => {
    setState(s => ({ ...s, error: null }));
  };

  return {
    ...state,
    setState,
    initialize,
    connectToPeer,
    callPeer,
    shareScreen,
    stopScreenShare,
    endCall,
    toggleAudio,
    toggleVideo,
    switchCamera,
    streamLocalMedia,
    startSecondaryStream,
    stopSecondaryStream,
    clearError,
  };
}
