import { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

export type PeerState = {
  peer: Peer | null;
  peerId: string;
  connections: DataConnection[];
  mediaConnection: MediaConnection | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error: string | null;
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
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const newPeer = new Peer();

    newPeer.on('open', (id) => {
      setState((s) => ({ ...s, peer: newPeer, peerId: id }));
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
      // Answer automatically if we already have a local stream, or prompt?
      // For simplicity, we'll answer without a stream initially, then add it if needed,
      // or we can request media here. Let's request media automatically for now.
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setState((s) => ({ ...s, localStream: stream, mediaConnection: call }));
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            setState((s) => ({ ...s, remoteStream }));
          });
          call.on('close', () => {
            setState((s) => ({ ...s, remoteStream: null, mediaConnection: null }));
          });
        })
        .catch((err) => {
          console.error('Failed to get local stream', err);
          // Answer without stream
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
         setState((s) => ({ ...s, remoteStream: null, mediaConnection: null }));
      });
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message }));
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
    setState(s => ({ ...s, mediaConnection: null, localStream: null, remoteStream: null }));
  };

  return {
    ...state,
    setState,
    connectToPeer,
    callPeer,
    endCall,
  };
}
