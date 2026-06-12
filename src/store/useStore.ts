import { create } from 'zustand';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

export interface UserPreferences {
  isMuted: boolean;
  isVideoOff: boolean;
  resolution: 'default' | '720p' | '1080p';
  facingMode: 'user' | 'environment';
}

export interface RoomState {
  inRoom: boolean;
  roomId: string | null;
  targetId: string | null;
}

export interface WebRTCState {
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
}

export interface AppState {
  preferences: UserPreferences;
  room: RoomState;
  webrtc: WebRTCState;
  
  // Actions
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setRoom: (room: Partial<RoomState>) => void;
  setWebRTC: (webrtc: Partial<WebRTCState> | ((prev: WebRTCState) => Partial<WebRTCState>)) => void;
  clearError: () => void;
  resetWebRTC: () => void;
}

export const useStore = create<AppState>((set) => ({
  preferences: {
    isMuted: false,
    isVideoOff: false,
    resolution: 'default',
    facingMode: 'user',
  },
  room: {
    inRoom: false,
    roomId: null,
    targetId: null,
  },
  webrtc: {
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
  },
  
  setPreferences: (prefs) => set((state) => ({
    preferences: { ...state.preferences, ...prefs }
  })),
  
  setRoom: (roomInfo) => set((state) => ({
    room: { ...state.room, ...roomInfo }
  })),
  
  setWebRTC: (webrtcUpdate) => set((state) => {
    const update = typeof webrtcUpdate === 'function' ? webrtcUpdate(state.webrtc) : webrtcUpdate;
    return {
      webrtc: { ...state.webrtc, ...update }
    };
  }),

  clearError: () => set((state) => ({
    webrtc: { ...state.webrtc, error: null }
  })),

  resetWebRTC: () => set((state) => ({
    webrtc: {
      ...state.webrtc,
      connections: [],
      mediaConnection: null,
      remoteStream: null,
      localStream: null,
      secondaryConnection: null,
      localSecondaryStream: null,
      remoteSecondaryStream: null,
      error: null,
      isScreenSharing: false,
    }
  }))
}));
