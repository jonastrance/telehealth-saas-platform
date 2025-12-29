import { useParams, useNavigate } from 'react-router-dom';
import { VideoCall } from '../components/VideoCall';

export const VideoCallPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const handleLeave = () => {
    navigate('/dashboard');
  };

  if (!roomId) {
    return <div>Invalid room ID</div>;
  }

  return <VideoCall roomId={roomId} onLeave={handleLeave} />;
};
