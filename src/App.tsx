import { useState } from 'react';
import { usePeer } from './lib/usePeer';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';

export default function App() {
  const peerState = usePeer();
  const [inRoom, setInRoom] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

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
  };

  // If we receive an incoming connection, automatically enter the room
  if (!inRoom && peerState.connections.length > 0) {
    setInRoom(true);
  }

  if (inRoom) {
    return (
      <Room 
        peerState={peerState} 
        targetId={targetId} 
        onLeave={handleLeave}
        onCall={peerState.callPeer}
        onEndCall={peerState.endCall}
      />
    );
  }

  return <Lobby peerId={peerState.peerId} onJoin={handleJoin} />;
}

