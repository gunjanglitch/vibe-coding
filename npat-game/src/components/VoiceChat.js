import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';

export default function VoiceChat({ roomId, playerName }) {
  const [callObject, setCallObject] = useState(null);
  const [participants, setParticipants] = useState({});
  const [muted, setMuted] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const co = DailyIframe.createCallObject({ audioSource: true, videoSource: false });
    setCallObject(co);

    co.on('participant-joined', updateParticipants);
    co.on('participant-updated', updateParticipants);
    co.on('participant-left', updateParticipants);
    co.on('joined-meeting', () => setJoined(true));
    co.on('error', (e) => setError('Voice chat unavailable'));

    // Join the Daily room — in production, create a room via Daily API
    // For now we use a placeholder room URL
    const dailyRoomUrl = `https://gunjansarode.daily.co/npat-game`;
    co.join({ url: dailyRoomUrl, userName: playerName })
      .catch(() => setError('Voice unavailable — check Daily.co setup'));

    return () => { co.destroy(); };
  }, [roomId, playerName]);

  const updateParticipants = () => {
    if (callObject) setParticipants({ ...callObject.participants() });
  };

  const toggleMute = () => {
    if (!callObject) return;
    callObject.setLocalAudio(muted);
    setMuted(!muted);
  };

  if (error) {
    return (
      <div className="voice-panel">
        <div style={{ 
          fontFamily: 'var(--font-note)', 
          fontSize: '0.75rem', 
          color: 'var(--ink-light)',
          background: 'var(--paper)',
          border: '1px dashed var(--border)',
          borderRadius: '4px',
          padding: '0.3rem 0.6rem',
          maxWidth: '180px',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          🎙️ Voice needs Daily.co setup
        </div>
      </div>
    );
  }

  const speakingParticipants = Object.values(participants).filter(p => p.tracks?.audio?.state === 'playable' && !p.local);

  return (
    <div className="voice-panel">
      {/* Speaking indicators */}
      {Object.values(participants).map(p => {
        const isSpeaking = p.tracks?.audio?.state === 'playable' && p.audio;
        return (
          <div key={p.session_id} className={`voice-tile ${isSpeaking ? 'speaking' : ''}`}>
            <span>{isSpeaking ? '🎙️' : '🔇'}</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem' }}>
              {p.user_name || 'Player'} {p.local ? '(you)' : ''}
            </span>
          </div>
        );
      })}

      {/* Mute button */}
      {joined && (
        <button 
          className={`mic-btn ${muted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🎙️'}
        </button>
      )}

      {!joined && !error && (
        <div className="voice-tile">
          <span>⏳</span>
          <span style={{ fontSize: '0.8rem' }}>Connecting...</span>
        </div>
      )}
    </div>
  );
}
