import { useState, useRef, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

export type PeerState = {
  peer: Peer | null;
  peerId: string;
  connections: DataConnection[];
  mediaConnection: MediaConnection | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
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

  const callPeer = async (targetId: string, video: boolean = true, audio: boolean = true) => {
    const { peer } = stateRef.current;
    if (!peer) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
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

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      
      const { mediaConnection, localStream } = stateRef.current;
      
      if (mediaConnection) {
        const sender = mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
      
      // Keep audio from localStream if it exists
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }

      setState(s => ({ ...s, localStream: stream, isScreenSharing: true }));

      videoTrack.onended = async () => {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const camTrack = camStream.getVideoTracks()[0];
          if (stateRef.current.mediaConnection) {
            const sender = stateRef.current.mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(camTrack);
            }
          }
          setState(s => ({ ...s, localStream: camStream, isScreenSharing: false }));
        } catch (e) {
          console.error("Failed to revert to camera", e);
          setState(s => ({ ...s, isScreenSharing: false }));
        }
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
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

  return {
    ...state,
    setState,
    initialize,
    connectToPeer,
    callPeer,
    shareScreen,
    endCall,
  };
}
