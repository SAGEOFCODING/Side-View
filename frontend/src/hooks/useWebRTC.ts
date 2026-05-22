import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://stream-backend-o7nw.onrender.com';

// ICE server configuration — TURN credentials loaded from environment
function getIceServers() {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    // Support multiple TURN URLs (comma-separated)
    const turnUrls = turnUrl.split(',').map(u => u.trim());
    for (const url of turnUrls) {
      servers.push({
        urls: url,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  return servers;
}

export function useWebRTC(roomId: string, shouldConnect: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const webcamConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const screenConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  
  // Track if we've already set up (for React strict mode double-invoke)
  const isSetupRef = useRef(false);

  // Track screen share track listener for cleanup
  const screenTrackListenerRef = useRef<{ track: MediaStreamTrack; handler: () => void } | null>(null);

  // Queue ICE candidates arriving before connection is ready or remoteDescription is set
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const {
    setSocketId,
    setLocalStream,
    setLocalScreenStream,
    addRemoteUser,
    removeRemoteUser,
    setRemoteStream,
    setRemoteScreenStream,
    setConnectionStatus,
    setLocalUserFlags,
    setRemoteUserFlags,
  } = useStore();

  const getMedia = useCallback(async (): Promise<{ stream: MediaStream | null; error: string | null }> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { stream: null, error: 'Browser does not support media devices. Are you using HTTPS or localhost?' };
      }
      
      // Add a 15-second timeout in case the permission prompt hangs silently
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Permission prompt timed out. Please check your browser address bar for a blocked camera icon.')), 15000)
        )
      ]);
      
      setLocalStream(stream);
      return { stream, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error accessing camera/microphone.';
      console.error('Failed to get local stream', err);
      return { stream: null, error: message };
    }
  }, [setLocalStream]);

  const closeConnection = useCallback((userId: string, type: 'webcam' | 'screen') => {
    const connections = type === 'webcam' ? webcamConnectionsRef : screenConnectionsRef;
    const pc = connections.current[userId];
    if (pc) {
      pc.close();
      delete connections.current[userId];
    }
    const key = `${type}-${userId}`;
    delete pendingCandidatesRef.current[key];
  }, []);

  const processPendingCandidates = useCallback(async (senderId: string, connectionType: 'webcam' | 'screen', pc: RTCPeerConnection) => {
    const key = `${connectionType}-${senderId}`;
    const pending = pendingCandidatesRef.current[key];
    if (pending && pending.length > 0) {
      console.log(`[WebRTC] Processing ${pending.length} pending ICE candidates for ${senderId} (${connectionType})`);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Error adding queued ICE candidate:`, err);
        }
      }
      delete pendingCandidatesRef.current[key];
    }
  }, []);

  const initiateConnection = useCallback(async (targetUserId: string, type: 'webcam' | 'screen') => {
    console.log(`[WebRTC] Initiating ${type} connection to ${targetUserId}`);
    
    // Create new peer connection
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    if (type === 'webcam') {
      webcamConnectionsRef.current[targetUserId] = pc;
    } else {
      screenConnectionsRef.current[targetUserId] = pc;
    }

    // Add local stream tracks to the connection
    const localStream = type === 'webcam'
      ? useStore.getState().localUser.stream
      : useStore.getState().localUser.screenStream;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal', {
          targetId: targetUserId,
          signal: {
            type: 'candidate',
            candidate: event.candidate,
            connectionType: type
          }
        });
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote ${type} track from ${targetUserId}`);
      const tracks = pc.getReceivers().map(r => r.track).filter(Boolean);
      const remoteStream = new MediaStream(tracks);
      if (type === 'webcam') {
        setRemoteStream(targetUserId, remoteStream);
      } else {
        setRemoteScreenStream(targetUserId, remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state to ${targetUserId} (${type}): ${pc.connectionState}`);
    };

    // Create SDP offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal', {
        targetId: targetUserId,
        signal: {
          type: 'offer',
          sdp: offer.sdp,
          connectionType: type
        }
      });
    } catch (err) {
      console.error(`[WebRTC] Error creating offer for ${targetUserId} (${type}):`, err);
    }
  }, [setRemoteStream, setRemoteScreenStream]);

  const handleSignalingMessage = useCallback(async (senderId: string, signal: any) => {
    const { type, sdp, candidate, connectionType } = signal;
    
    const connections = connectionType === 'webcam' ? webcamConnectionsRef : screenConnectionsRef;
    let pc = connections.current[senderId];

    // If candidate, check if we can add it or need to queue it
    if (type === 'candidate') {
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Error adding ICE candidate from ${senderId} (${connectionType}):`, err);
        }
      } else {
        const key = `${connectionType}-${senderId}`;
        if (!pendingCandidatesRef.current[key]) {
          pendingCandidatesRef.current[key] = [];
        }
        pendingCandidatesRef.current[key].push(candidate);
        console.log(`[WebRTC] Queued ICE candidate from ${senderId} (${connectionType})`);
      }
      return;
    }

    if (!pc) {
      console.log(`[WebRTC] Creating new peer connection to answer ${connectionType} from ${senderId}`);
      pc = new RTCPeerConnection({ iceServers: getIceServers() });
      connections.current[senderId] = pc;

      // If answering webcam connection, add our local webcam/mic tracks (two-way)
      if (connectionType === 'webcam') {
        const localStream = useStore.getState().localUser.stream;
        if (localStream) {
          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('signal', {
            targetId: senderId,
            signal: {
              type: 'candidate',
              candidate: event.candidate,
              connectionType
            }
          });
        }
      };

      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received ${connectionType} track from incoming connection: ${senderId}`);
        const tracks = pc.getReceivers().map(r => r.track).filter(Boolean);
        const remoteStream = new MediaStream(tracks);
        if (connectionType === 'webcam') {
          setRemoteStream(senderId, remoteStream);
        } else {
          setRemoteScreenStream(senderId, remoteStream);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state for incoming ${senderId} (${connectionType}): ${pc.connectionState}`);
      };
    }

    if (type === 'offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        await processPendingCandidates(senderId, connectionType, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('signal', {
          targetId: senderId,
          signal: {
            type: 'answer',
            sdp: answer.sdp,
            connectionType
          }
        });
      } catch (err) {
        console.error(`[WebRTC] Error handling offer from ${senderId} (${connectionType}):`, err);
      }
    } else if (type === 'answer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        await processPendingCandidates(senderId, connectionType, pc);
      } catch (err) {
        console.error(`[WebRTC] Error setting remote description from ${senderId} (${connectionType}):`, err);
      }
    }
  }, [setRemoteStream, setRemoteScreenStream, processPendingCandidates]);

  useEffect(() => {
    if (!shouldConnect) return;
    // Prevent double setup in React strict mode
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    console.log(`[WebRTC] Setting up room connection for ${roomId}`);
    setConnectionStatus('connecting');

    // Connect to Socket.io for signaling
    socketRef.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    
    socketRef.current.on('connect', () => {
      console.log(`[WebRTC] Socket connected: ${socketRef.current!.id}`);
      setSocketId(socketRef.current!.id as string);
      setConnectionStatus('connected');
      
      // Join room and announce initial media status
      const localUser = useStore.getState().localUser;
      socketRef.current?.emit('join_room', { 
        roomId, 
        peerId: socketRef.current!.id, // use socket id as peer id to keep backend happy
        micMuted: localUser.micMuted,
        cameraOff: localUser.cameraOff
      });
    });

    socketRef.current.on('room_full', (data: { message: string }) => {
      setConnectionStatus('error');
      alert(data.message);
      window.location.href = '/';
    });

    socketRef.current.on('error_message', (data: { message: string }) => {
      console.error('[WebRTC] Server error:', data.message);
    });

    socketRef.current.on('server_shutdown', () => {
      setConnectionStatus('reconnecting');
    });

    // Handle list of users already in the room when we join
    socketRef.current.on('existing_users', (users: Array<{ userId: string; peerId: string; micMuted?: boolean; cameraOff?: boolean }>) => {
      console.log(`[WebRTC] Received existing users:`, users);
      for (const user of users) {
        if (user.userId) {
          addRemoteUser(user.userId, { micMuted: user.micMuted, cameraOff: user.cameraOff });
          // We are the joiner, so we initiate the webcam connection to the existing user
          initiateConnection(user.userId, 'webcam');
        }
      }
    });

    // Handle a new user joining after us
    socketRef.current.on('user_joined', ({ userId, micMuted, cameraOff }: { userId: string; peerId: string; micMuted?: boolean; cameraOff?: boolean }) => {
      console.log(`[WebRTC] User joined: ${userId}`);
      addRemoteUser(userId, { micMuted, cameraOff });
      // We do not initiate webcam call to them; they are the joiner and will call us.
      
      // BUT if we are actively screen sharing, we MUST initiate the screen share connection to them!
      const screenStream = useStore.getState().localUser.screenStream;
      if (screenStream) {
        initiateConnection(userId, 'screen');
      }
    });

    // Handle WebRTC signaling messages
    socketRef.current.on('signal', async ({ senderId, signal }) => {
      await handleSignalingMessage(senderId, signal);
    });

    socketRef.current.on('user_left', (userId: string) => {
      console.log(`[WebRTC] User left: ${userId}`);
      removeRemoteUser(userId);
      closeConnection(userId, 'webcam');
      closeConnection(userId, 'screen');
    });

    // Handle remote user stopping their screen share
    socketRef.current.on('screen_share_stopped', ({ userId }: { userId: string }) => {
      console.log(`[WebRTC] Remote user ${userId} stopped screen sharing`);
      setRemoteScreenStream(userId, null);
      closeConnection(userId, 'screen');
    });

    // Handle remote user state changes (mute, camera toggle)
    socketRef.current.on('user_state_changed', ({ userId, micMuted, cameraOff }: { userId: string; micMuted: boolean; cameraOff: boolean }) => {
      console.log(`[WebRTC] Remote user ${userId} state changed: micMuted=${micMuted}, cameraOff=${cameraOff}`);
      setRemoteUserFlags(userId, { micMuted, cameraOff });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[WebRTC] Socket disconnected:', reason);
      if (reason !== 'io client disconnect') {
        setConnectionStatus('reconnecting');
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('[WebRTC] Socket connection error:', err);
      setConnectionStatus('error');
    });

    socketRef.current.on('reconnect', () => {
      console.log('[WebRTC] Socket reconnected');
      setConnectionStatus('connected');
      
      const localUser = useStore.getState().localUser;
      socketRef.current?.emit('join_room', { 
        roomId, 
        peerId: socketRef.current!.id,
        micMuted: localUser.micMuted,
        cameraOff: localUser.cameraOff
      });
    });

    return () => {
      console.log('[WebRTC] Cleaning up...');
      isSetupRef.current = false;

      if (screenTrackListenerRef.current) {
        const { track, handler } = screenTrackListenerRef.current;
        track.removeEventListener('ended', handler);
        screenTrackListenerRef.current = null;
      }

      // Close all active connections
      Object.keys(webcamConnectionsRef.current).forEach(userId => closeConnection(userId, 'webcam'));
      Object.keys(screenConnectionsRef.current).forEach(userId => closeConnection(userId, 'screen'));

      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, shouldConnect]);

  const stopScreenShare = useCallback((stream: MediaStream) => {
    if (screenTrackListenerRef.current) {
      const { track, handler } = screenTrackListenerRef.current;
      track.removeEventListener('ended', handler);
      screenTrackListenerRef.current = null;
    }

    stream.getTracks().forEach(track => track.stop());
    setLocalScreenStream(null);
    
    // Close all screen share connections
    Object.keys(screenConnectionsRef.current).forEach((userId) => {
      closeConnection(userId, 'screen');
    });

    const state = useStore.getState();
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('screen_share_stopped', { roomId: state.roomId });
    }
  }, [closeConnection, setLocalScreenStream]);

  const startScreenShare = useCallback(async () => {
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: true,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.warn('[WebRTC] Screen share with audio failed, attempting fallback...', error);
      if (error.name === 'NotAllowedError') {
        return;
      }
      
      try {
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
      
      // Connect screen stream to all existing remote users
      Object.keys(useStore.getState().remoteUsers).forEach((remoteUserId) => {
        initiateConnection(remoteUserId, 'screen');
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      const handleTrackEnd = () => stopScreenShare(screenStream);
      videoTrack.addEventListener('ended', handleTrackEnd);
      
      screenTrackListenerRef.current = { track: videoTrack, handler: handleTrackEnd };
    } catch (err) {
      console.error('Error sharing screen', err);
    }
  }, [initiateConnection, setLocalScreenStream, stopScreenShare]);

  const toggleMic = useCallback(() => {
    const stream = useStore.getState().localUser.stream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        setLocalUserFlags({ micMuted: isMuted });
        
        if (socketRef.current) {
          socketRef.current.emit('user_state_changed', { 
            roomId, 
            micMuted: isMuted, 
            cameraOff: useStore.getState().localUser.cameraOff 
          });
        }
      }
    }
  }, [roomId, setLocalUserFlags]);

  const toggleVideo = useCallback(() => {
    const stream = useStore.getState().localUser.stream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const isOff = !videoTrack.enabled;
        setLocalUserFlags({ cameraOff: isOff });
        
        if (socketRef.current) {
          socketRef.current.emit('user_state_changed', { 
            roomId, 
            micMuted: useStore.getState().localUser.micMuted, 
            cameraOff: isOff 
          });
        }
      }
    }
  }, [roomId, setLocalUserFlags]);

  return { startScreenShare, stopScreenShare, getMedia, toggleMic, toggleVideo };
}
