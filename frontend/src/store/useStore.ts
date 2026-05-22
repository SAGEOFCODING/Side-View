import { create } from 'zustand';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UserState {
  id: string;
  isHost: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  micMuted: boolean;
  cameraOff: boolean;
  iceStatus?: string;
  name?: string;
}

interface RoomState {
  roomId: string | null;
  socketId: string | null;
  connectionStatus: ConnectionStatus;
  localUser: UserState;
  remoteUsers: Record<string, UserState>;
  isTheaterMode: boolean;
  setRoomId: (id: string) => void;
  setSocketId: (id: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  setLocalName: (name: string) => void;
  setLocalUserFlags: (flags: Partial<UserState>) => void;
  addRemoteUser: (id: string, flags?: Partial<UserState>) => void;
  removeRemoteUser: (id: string) => void;
  setRemoteStream: (id: string, stream: MediaStream | null) => void;
  setRemoteScreenStream: (id: string, stream: MediaStream | null) => void;
  setRemoteUserFlags: (id: string, flags: Partial<UserState>) => void;
  toggleTheaterMode: () => void;
  resetStore: () => void;
}

const initialLocalUser: UserState = {
  id: 'local',
  isHost: false,
  stream: null,
  screenStream: null,
  micMuted: false,
  cameraOff: false,
  name: '',
};

export const useStore = create<RoomState>((set) => ({
  roomId: null,
  socketId: null,
  connectionStatus: 'idle',
  localUser: { ...initialLocalUser },
  remoteUsers: {},
  isTheaterMode: false,

  setRoomId: (id) => set({ roomId: id }),
  setSocketId: (id) => set({ socketId: id }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLocalStream: (stream) => 
    set((state) => ({ localUser: { ...state.localUser, stream } })),
  setLocalScreenStream: (stream) => 
    set((state) => ({ localUser: { ...state.localUser, screenStream: stream } })),
  setLocalName: (name) =>
    set((state) => ({ localUser: { ...state.localUser, name } })),
  setLocalUserFlags: (flags) =>
    set((state) => ({ localUser: { ...state.localUser, ...flags } })),
    
  addRemoteUser: (id, flags) => set((state) => {
    if (state.remoteUsers[id]) {
      if (flags) {
        return {
          remoteUsers: {
            ...state.remoteUsers,
            [id]: { ...state.remoteUsers[id], ...flags }
          }
        };
      }
      return state;
    }
    return {
      remoteUsers: {
        ...state.remoteUsers,
        [id]: { id, isHost: false, stream: null, screenStream: null, micMuted: false, cameraOff: false, name: '', ...flags }
      }
    };
  }),
  removeRemoteUser: (id) => set((state) => {
    const newUsers = { ...state.remoteUsers };
    delete newUsers[id];
    return { remoteUsers: newUsers };
  }),
  setRemoteStream: (id, stream) => set((state) => {
    if (!state.remoteUsers[id]) return state;
    return {
      remoteUsers: {
        ...state.remoteUsers,
        [id]: { ...state.remoteUsers[id], stream }
      }
    };
  }),
  setRemoteScreenStream: (id, stream) => set((state) => {
    if (!state.remoteUsers[id]) return state;
    return {
      remoteUsers: {
        ...state.remoteUsers,
        [id]: { ...state.remoteUsers[id], screenStream: stream }
      }
    };
  }),
  setRemoteUserFlags: (id, flags) => set((state) => {
    if (!state.remoteUsers[id]) return state;
    return {
      remoteUsers: {
        ...state.remoteUsers,
        [id]: { ...state.remoteUsers[id], ...flags }
      }
    };
  }),
  toggleTheaterMode: () => set((state) => ({ isTheaterMode: !state.isTheaterMode })),
  resetStore: () => set({
    roomId: null,
    socketId: null,
    connectionStatus: 'idle',
    localUser: { ...initialLocalUser },
    remoteUsers: {},
    isTheaterMode: false,
  }),
}));
