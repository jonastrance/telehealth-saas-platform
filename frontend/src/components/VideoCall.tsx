import { useEffect, useRef, useState } from 'react';

interface VideoCallProps {
  roomId: string;
  onLeave: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomId, onLeave }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initializeVideoCall();
    
    return () => {
      cleanup();
    };
  }, [roomId]);

  const initializeVideoCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to signaling server
      const token = localStorage.getItem('accessToken');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host.includes('localhost') ? 'localhost:5000' : window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/video-signal?token=${token}`);
      
      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await handleSignalingMessage(message, stream);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error initializing video call:', error);
      // In production, this should use a proper toast/notification component
      if (window.confirm('Failed to access camera/microphone. Please check permissions. Return to dashboard?')) {
        onLeave();
      }
    }
  };

  const handleSignalingMessage = async (message: any, stream: MediaStream) => {
    switch (message.type) {
      case 'connected':
        // Join room after connection
        wsRef.current?.send(JSON.stringify({
          type: 'join-room',
          roomId,
        }));
        break;

      case 'room-joined':
        setParticipants(message.participants.map((p: any) => p.userId));
        
        // Create offers for existing participants
        for (const participant of message.participants) {
          await createPeerConnection(stream, participant.userId);
          await createOffer(participant.userId);
        }
        break;

      case 'user-joined':
        setParticipants((prev) => [...prev, message.userId]);
        break;

      case 'user-left':
        setParticipants((prev) => prev.filter((id) => id !== message.userId));
        break;

      case 'offer':
        await handleOffer(message, stream);
        break;

      case 'answer':
        await handleAnswer(message);
        break;

      case 'ice-candidate':
        await handleIceCandidate(message);
        break;
    }
  };

  const createPeerConnection = async (stream: MediaStream, remoteUserId: string) => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetUserId: remoteUserId,
        }));
      }
    };

    peerConnectionRef.current = peerConnection;
  };

  const createOffer = async (remoteUserId: string) => {
    if (!peerConnectionRef.current) return;

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);

    wsRef.current?.send(JSON.stringify({
      type: 'offer',
      offer,
      targetUserId: remoteUserId,
    }));
  };

  const handleOffer = async (message: any, stream: MediaStream) => {
    await createPeerConnection(stream, message.fromUserId);
    
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.setRemoteDescription(
      new RTCSessionDescription(message.offer)
    );

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    wsRef.current?.send(JSON.stringify({
      type: 'answer',
      answer,
      targetUserId: message.fromUserId,
    }));
  };

  const handleAnswer = async (message: any) => {
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.setRemoteDescription(
      new RTCSessionDescription(message.answer)
    );
  };

  const handleIceCandidate = async (message: any) => {
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.addIceCandidate(
      new RTCIceCandidate(message.candidate)
    );
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleLeaveCall = () => {
    wsRef.current?.send(JSON.stringify({
      type: 'leave-room',
    }));
    
    cleanup();
    onLeave();
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.videoGrid}>
        <div style={styles.videoWrapper}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={styles.remoteVideo}
          />
          <div style={styles.videoLabel}>Remote Participant</div>
        </div>
        
        <div style={styles.videoWrapper}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={styles.localVideo}
          />
          <div style={styles.videoLabel}>You</div>
        </div>
      </div>

      <div style={styles.controls}>
        <button onClick={toggleMute} style={styles.button}>
          {isMuted ? '🔇 Unmute' : '🔊 Mute'}
        </button>
        
        <button onClick={toggleVideo} style={styles.button}>
          {isVideoOff ? '📹 Turn On Video' : '📷 Turn Off Video'}
        </button>
        
        <button onClick={handleLeaveCall} style={styles.leaveButton}>
          📞 Leave Call
        </button>
      </div>

      <div style={styles.status}>
        {isConnected ? (
          <span style={styles.connected}>● Connected</span>
        ) : (
          <span style={styles.disconnected}>● Connecting...</span>
        )}
        <span style={styles.participants}>
          {participants.length + 1} participant(s)
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a1a',
  },
  videoGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
    padding: '20px',
  },
  videoWrapper: {
    position: 'relative',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoLabel: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    padding: '20px',
    backgroundColor: '#2a2a2a',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#4a4a4a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  leaveButton: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#d32f2f',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  status: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: '#2a2a2a',
    color: 'white',
    fontSize: '14px',
  },
  connected: {
    color: '#4caf50',
  },
  disconnected: {
    color: '#ff9800',
  },
  participants: {
    color: '#9e9e9e',
  },
};
