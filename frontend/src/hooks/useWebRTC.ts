import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type Peer from 'peerjs';
import type { MediaConnection } from 'peerjs';
import { useStore } from '../store/useStore';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://sideview-backend-252675432928.us-central1.run.app';

export function useWebRTC(roomId: string, shouldConnect: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const peerInstanceRef = useRef<Peer | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  
  // We keep track of peer connections to close them if needed
  const webcamCallsRef = useRef<Record<string, MediaConnection>>({});
  const screenCallsRef = useRef<Record<string, MediaConnection>>({});
  
  // We need to map Peer IDs to User IDs (socket IDs), and vice versa
  const peerToUserMap = useRef<Record<string, string>>({});
  const userToPeerMap = useRef<Record<string, string>>({});

  // Track if we've already set up (for React strict mode double-invoke)
  const isSetupRef = useRef(false);

  const {
    setSocketId,
    setLocalStream,
    setLocalScreenStream,
    addRemoteUser,
    removeRemoteUser,
    setRemoteStream,
    setRemoteScreenStream
  } = useStore();

  const getMedia = useCallback(async (): Promise<{ stream: MediaStream | null; error: string | null }> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { stream: null, error: 'Browser does not support media devices. Are you using HTTPS or localhost?' };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      setLocalStream(stream);
      return { stream, error: null };
    } catch (err: any) {
      console.error('Failed to get local stream', err);
      return { stream: null, error: err.message || 'Unknown error accessing camera/microphone.' };
    }
  }, [setLocalStream]);

  // Handle incoming streams — maps peerIds back to userIds correctly
  const handleIncomingStream = useCallback((call: MediaConnection, remoteStream: MediaStream) => {
    const remotePeerId = call.peer;
    const userId = peerToUserMap.current[remotePeerId] || remotePeerId;
    
    const isScreen = call.metadata?.type === 'screen';
    
    // Ensure the remote user exists in the store before setting streams
    const state = useStore.getState();
    if (!state.remoteUsers[userId]) {
      addRemoteUser(userId);
    }

    if (isScreen) {
      setRemoteScreenStream(userId, remoteStream);
    } else {
      setRemoteStream(userId, remoteStream);
    }
  }, [setRemoteStream, setRemoteScreenStream, addRemoteUser]);

  // Make a call to a peer
  const callPeer = useCallback((targetPeerId: string, stream: MediaStream, type: 'webcam' | 'screen') => {
    if (!peerInstanceRef.current) return;
    
    console.log(`[WebRTC] Calling peer ${targetPeerId} with ${type}`);
    
    const call = peerInstanceRef.current.call(targetPeerId, stream, {
      metadata: { type }
    });
    
    if (!call) {
      console.error(`[WebRTC] Failed to create call to ${targetPeerId}`);
      return;
    }

    if (type === 'webcam') webcamCallsRef.current[targetPeerId] = call;
    if (type === 'screen') screenCallsRef.current[targetPeerId] = call;

    call.on('stream', (remoteStream) => {
      console.log(`[WebRTC] Received ${type} stream from peer ${targetPeerId}`);
      handleIncomingStream(call, remoteStream);
    });
    
    call.on('close', () => {
      console.log(`[WebRTC] Call to ${targetPeerId} (${type}) closed`);
    });

    call.on('error', (err) => {
      console.error(`[WebRTC] Call error with ${targetPeerId} (${type}):`, err);
    });
  }, [handleIncomingStream]);

  // Setup a newly discovered remote user — map their IDs and call them
  const setupRemoteUser = useCallback((userId: string, peerId: string) => {
    addRemoteUser(userId);
    peerToUserMap.current[peerId] = userId;
    userToPeerMap.current[userId] = peerId;
    
    // Call them with our webcam stream if we have one
    const currentStream = useStore.getState().localUser.stream;
    if (currentStream) {
      callPeer(peerId, currentStream, 'webcam');
    }
    
    // Also call with screen share if active
    const screenStream = useStore.getState().localUser.screenStream;
    if (screenStream) {
      callPeer(peerId, screenStream, 'screen');
    }
  }, [addRemoteUser, callPeer]);

  useEffect(() => {
    if (!shouldConnect) return;
    // Prevent double setup in React strict mode
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    console.log(`[WebRTC] Setting up for room ${roomId}`);

    // Dynamically import PeerJS so it doesn't break SSR in Next.js
    import('peerjs').then(({ default: PeerConstructor }) => {
      const url = new URL(SOCKET_SERVER_URL);
      const peer = new PeerConstructor({
        host: url.hostname,
        secure: url.protocol === 'https:',
        port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
        path: '/peerjs',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });
      peerInstanceRef.current = peer;

      peer.on('open', (id) => {
        myPeerIdRef.current = id;
        console.log(`[WebRTC] PeerJS open with id: ${id}`);
        
        // Now connect to Socket.io for room discovery
        socketRef.current = io(SOCKET_SERVER_URL, {
          transports: ['websocket'], // FORCE WebSockets to avoid Cloud Run Session ID polling mismatches
        });
        
        socketRef.current.on('connect', () => {
          console.log(`[WebRTC] Socket connected: ${socketRef.current!.id}`);
          setSocketId(socketRef.current!.id as string);
          // Join room and announce our Peer ID
          socketRef.current?.emit('join_room', { roomId, peerId: id });
        });

        socketRef.current.on('room_full', (data: { message: string }) => {
          alert(data.message);
          window.location.href = '/';
        });

        // Handle list of users already in the room when we join
        socketRef.current.on('existing_users', (users: Array<{ userId: string; peerId: string }>) => {
          console.log(`[WebRTC] Received existing users:`, users);
          for (const user of users) {
            if (user.peerId) {
              setupRemoteUser(user.userId, user.peerId);
            }
          }
        });

        // Handle a new user joining after us
        socketRef.current.on('user_joined', ({ userId, peerId }: { userId: string; peerId: string }) => {
          console.log(`[WebRTC] User joined: ${userId} (peer: ${peerId})`);
          setupRemoteUser(userId, peerId);
        });

        socketRef.current.on('user_left', (userId: string) => {
          console.log(`[WebRTC] User left: ${userId}`);
          removeRemoteUser(userId);
          const peerId = userToPeerMap.current[userId];
          if (peerId) {
            if (webcamCallsRef.current[peerId]) {
              webcamCallsRef.current[peerId].close();
              delete webcamCallsRef.current[peerId];
            }
            if (screenCallsRef.current[peerId]) {
              screenCallsRef.current[peerId].close();
              delete screenCallsRef.current[peerId];
            }
            delete peerToUserMap.current[peerId];
            delete userToPeerMap.current[userId];
          }
        });

        // Handle remote user stopping their screen share
        socketRef.current.on('screen_share_stopped', ({ userId }: { userId: string }) => {
          console.log(`[WebRTC] Remote user ${userId} stopped screen sharing`);
          setRemoteScreenStream(userId, null);
        });

        socketRef.current.on('disconnect', () => {
          console.log('[WebRTC] Socket disconnected');
        });

        socketRef.current.on('connect_error', (err) => {
          console.error('[WebRTC] Socket connection error:', err);
        });
      });

      // Handle incoming calls from other peers
      peer.on('call', (call) => {
        const type = call.metadata?.type || 'webcam';
        console.log(`[WebRTC] Incoming ${type} call from ${call.peer}`);
        
        if (type === 'webcam') {
          // Answer with our local stream so both sides see each other
          const localStream = useStore.getState().localUser.stream;
          if (localStream) {
            call.answer(localStream);
          } else {
            // Still answer to establish the connection even without camera
            call.answer();
          }
        } else if (type === 'screen') {
          // Screen share — just receive, don't send anything back
          call.answer();
        }

        call.on('stream', (remoteStream) => {
          console.log(`[WebRTC] Received ${type} stream from incoming call: ${call.peer}`);
          handleIncomingStream(call, remoteStream);
        });

        call.on('error', (err) => {
          console.error(`[WebRTC] Incoming call error from ${call.peer}:`, err);
        });
      });

      peer.on('error', (err) => {
        console.error('[WebRTC] PeerJS error:', err);
      });

      peer.on('disconnected', () => {
        console.log('[WebRTC] PeerJS disconnected, attempting reconnect...');
        peer.reconnect();
      });
    });

    return () => {
      console.log('[WebRTC] Cleaning up...');
      isSetupRef.current = false;

      // Close all active calls
      Object.values(webcamCallsRef.current).forEach(call => call.close());
      Object.values(screenCallsRef.current).forEach(call => call.close());
      webcamCallsRef.current = {};
      screenCallsRef.current = {};

      // Clear mappings
      peerToUserMap.current = {};
      userToPeerMap.current = {};

      // Disconnect socket & destroy peer
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (peerInstanceRef.current) {
        peerInstanceRef.current.destroy();
        peerInstanceRef.current = null;
      }
      myPeerIdRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, shouldConnect]);

  const startScreenShare = async () => {
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: true, // Request system audio
      });
    } catch (err: any) {
      console.warn('[WebRTC] Screen share with audio failed, attempting fallback...', err);
      // If the user explicitly denied permission, don't retry
      if (err.name === 'NotAllowedError') {
        return;
      }
      
      try {
        alert("Notice: Your browser does not support system audio sharing. Sharing screen video only.");
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        });
      } catch (fallbackErr) {
        console.error('[WebRTC] Fallback screen share failed:', fallbackErr);
        return;
      }
    }

    try {
      setLocalScreenStream(screenStream);
      
      // Call all existing peers with the screen stream
      Object.values(userToPeerMap.current).forEach((peerId) => {
        callPeer(peerId, screenStream, 'screen');
      });

      // When the user clicks "Stop sharing" in the browser's native UI
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare(screenStream);
      };
    } catch (err) {
      console.error('Error sharing screen', err);
    }
  };

  const stopScreenShare = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach(track => track.stop());
    setLocalScreenStream(null);
    
    // Close all screen share calls
    Object.values(screenCallsRef.current).forEach(call => {
       call.close();
    });
    screenCallsRef.current = {};

    // Notify remote users via socket that we stopped screen sharing
    const state = useStore.getState();
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('screen_share_stopped', { roomId: state.roomId });
    }
  }, [setLocalScreenStream]);

  return { startScreenShare, stopScreenShare, getMedia };
}
