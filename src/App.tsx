import { useState, useEffect } from 'react';
import { usePeer } from './lib/usePeer';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';

export default function App() {
  const peerState = usePeer();
  const [inRoom, setInRoom] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!inRoom && peerState.connections.length > 0) {
      setInRoom(true);
      if (!targetId) {
        setTargetId(peerState.connections[0].peer);
      }
    }
  }, [inRoom, peerState.connections, targetId]);

  const handleJoin = (id: string) => {
    peerState.connectToPeer(id);
    setTargetId(id);
    setInRoom(true);
  };

  const handleLeave = () => {
    peerState.endCall();
    peerState.connections.forEach(c => c.close());
    setInRoom(false);
    setTargetId(null);
    peerState.clearError();
  };

  if (inRoom) {
    return (
      <Room 
        peerState={peerState} 
        targetId={targetId} 
        onLeave={handleLeave}
        onCall={peerState.callPeer}
        onEndCall={peerState.endCall}
        onShareScreen={peerState.shareScreen}
      />
    );
  }

  return (
    <Lobby 
      peerId={peerState.peerId} 
      onInitialize={peerState.initialize} 
      onJoin={handleJoin} 
      error={peerState.error}
    />
  );
}
