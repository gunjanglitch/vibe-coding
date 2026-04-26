import React, { useState } from 'react';
import { supabase } from '../supabase';
import { generateRoomCode, DEFAULT_COLUMNS } from '../constants';

export default function HomeScreen({ player, onJoinRoom }) {
  const [name, setName] = useState(player?.name || '');
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return setError('Write your name first!');
    if (!roomName.trim()) return setError('Give your room a name!');
    setLoading(true); setError('');
    const code = generateRoomCode();
    const { error: err } = await supabase.from('rooms').insert({
      id: code,
      name: roomName.trim(),
      host_id: player.id,
      status: 'lobby',
      total_rounds: 5,
      current_round: 0,
      custom_columns: [],
      sayer_index: 0,
      stopper_index: 1,
    });
    if (err) { setError('Could not create room. Check Supabase setup.'); setLoading(false); return; }
    await onJoinRoom(code, name.trim());
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError('Write your name first!');
    if (!roomCode.trim()) return setError('Enter the room code!');
    setLoading(true); setError('');
    const { data, error: err } = await supabase.from('rooms').select('*').eq('id', roomCode.toUpperCase()).single();
    if (err || !data) { setError('Room not found! Check the code.'); setLoading(false); return; }
    if (data.status !== 'lobby') { setError('Game already started in this room!'); setLoading(false); return; }
    await onJoinRoom(roomCode.toUpperCase(), name.trim());
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem' }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          fontFamily: 'var(--font-note)', 
          fontSize: '3.5rem', 
          fontWeight: 700,
          color: 'var(--ink)',
          lineHeight: 1.1,
          textShadow: '3px 3px 0 rgba(0,0,0,0.1)'
        }}>
          Name Place
        </div>
        <div style={{ 
          fontFamily: 'var(--font-note)', 
          fontSize: '3.5rem', 
          fontWeight: 700,
          color: 'var(--accent)',
          lineHeight: 1.1,
        }}>
          Animal Thing
        </div>
        <div style={{ 
          fontFamily: 'var(--font-ui)', 
          fontSize: '1rem', 
          color: 'var(--ink-light)',
          marginTop: '0.5rem',
          letterSpacing: '0.1em'
        }}>
          the classic notebook game ✏️
        </div>
      </div>

      {/* Main card */}
      <div className="notebook-page" style={{ 
        padding: '2rem 2rem 2rem 4.5rem',
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Name input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontFamily: 'var(--font-note)', fontSize: '1rem', color: 'var(--ink-light)', display: 'block', marginBottom: '0.3rem' }}>
            Your name
          </label>
          <input
            className="hand-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Write your name..."
            style={{ fontSize: '1.4rem' }}
            onKeyDown={e => e.key === 'Enter' && !mode && setMode('create')}
          />
        </div>

        {!mode && (
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button className="btn btn-primary" onClick={() => setMode('create')} style={{ width: '100%', fontSize: '1.2rem', padding: '0.8rem' }}>
              ✏️ Create Room
            </button>
            <button className="btn" onClick={() => setMode('join')} style={{ width: '100%', fontSize: '1.2rem', padding: '0.8rem' }}>
              🚪 Join Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontFamily: 'var(--font-note)', fontSize: '1rem', color: 'var(--ink-light)', display: 'block', marginBottom: '0.3rem' }}>
                Room name
              </label>
              <input
                className="hand-input"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="e.g. Friday Game Night"
                style={{ fontSize: '1.2rem' }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="btn" onClick={() => setMode(null)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading} style={{ flex: 2 }}>
                {loading ? 'Creating...' : '🎮 Create!'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontFamily: 'var(--font-note)', fontSize: '1rem', color: 'var(--ink-light)', display: 'block', marginBottom: '0.3rem' }}>
                Room code
              </label>
              <input
                className="hand-input"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. XK92AB"
                style={{ fontSize: '1.4rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="btn" onClick={() => setMode(null)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary" onClick={handleJoin} disabled={loading} style={{ flex: 2 }}>
                {loading ? 'Joining...' : '🚀 Join!'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ 
            marginTop: '1rem',
            fontFamily: 'var(--font-note)', 
            color: 'var(--accent)', 
            fontSize: '0.95rem',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.85rem', color: 'var(--ink-light)', textAlign: 'center', opacity: 0.7 }}>
        gather your friends · pick a letter · write fast ✏️
      </div>
    </div>
  );
}
