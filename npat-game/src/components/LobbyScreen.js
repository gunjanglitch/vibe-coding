import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { DEFAULT_COLUMNS } from '../constants';

export default function LobbyScreen({ player, room, onGameStart, onRoomUpdate }) {
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState(room?.total_rounds || 5);
  const [customCols, setCustomCols] = useState(room?.custom_columns || []);
  const [newCol, setNewCol] = useState('');
  const [copied, setCopied] = useState(false);
  const isHost = room?.host_id === player.id;

  useEffect(() => {
    fetchPlayers();
    // Subscribe to players joining
    const sub = supabase.channel(`lobby-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, fetchPlayers)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: updated }) => {
        onRoomUpdate(updated);
        if (updated.status === 'playing') onGameStart(updated);
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [room.id]);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').eq('room_id', room.id).order('joined_at');
    if (data) setPlayers(data);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addColumn = () => {
    const col = newCol.trim();
    if (!col || customCols.includes(col) || DEFAULT_COLUMNS.includes(col)) return;
    if (customCols.length >= 5) return;
    setCustomCols(prev => [...prev, col]);
    setNewCol('');
  };

  const removeColumn = (col) => setCustomCols(prev => prev.filter(c => c !== col));

  const handleStart = async () => {
    if (players.length < 1) return;
    await supabase.from('rooms').update({
      status: 'playing',
      total_rounds: rounds,
      custom_columns: customCols,
      current_round: 1,
      sayer_index: 0,
      stopper_index: Math.min(1, players.length - 1),
    }).eq('id', room.id);
  };

  const allColumns = [...DEFAULT_COLUMNS, ...customCols];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem', maxWidth: '560px', margin: '0 auto' }}>
      {/* Room header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-note)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--ink)' }}>
          {room.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.95rem', color: 'var(--ink-light)' }}>Room Code:</span>
          <span style={{ 
            fontFamily: 'var(--font-note)', 
            fontSize: '1.6rem', 
            fontWeight: 700,
            letterSpacing: '0.2em',
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '0.1rem 0.8rem',
            borderRadius: '4px'
          }}>{room.id}</span>
          <button className="btn" onClick={copyCode} style={{ fontSize: '0.85rem', padding: '0.3rem 0.7rem' }}>
            {copied ? '✅' : '📋 Copy'}
          </button>
        </div>
        <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.9rem', color: 'var(--ink-light)', marginTop: '0.3rem', fontStyle: 'italic' }}>
          Share this code with your friends!
        </div>
      </div>

      {/* Players list */}
      <div className="notebook-page" style={{ padding: '1.5rem 1.5rem 1.5rem 4rem', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-note)', fontSize: '1.1rem', color: 'var(--ink-light)', marginBottom: '0.8rem' }}>
          Players ({players.length})
        </div>
        {players.map((p, i) => (
          <div key={p.id} style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontFamily: 'var(--font-hand)', fontSize: '1.2rem',
            padding: '0.3rem 0', borderBottom: '1px solid var(--ruled-line)'
          }}>
            <span style={{ color: 'var(--ink-light)', fontSize: '0.9rem', minWidth: '20px' }}>{i+1}.</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.id === room.host_id && (
              <span style={{ fontSize: '0.75rem', background: 'var(--ink)', color: 'var(--paper)', padding: '0.1rem 0.5rem', borderRadius: '50px' }}>
                host
              </span>
            )}
            {p.id === player.id && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent2)', fontStyle: 'italic' }}>you</span>
            )}
          </div>
        ))}
        {players.length === 0 && (
          <div style={{ fontFamily: 'var(--font-note)', color: 'var(--ink-light)', fontStyle: 'italic', fontSize: '1rem', textAlign: 'center', padding: '1rem' }}>
            Waiting for players...
          </div>
        )}
      </div>

      {/* Settings — only host */}
      {isHost && (
        <div className="notebook-page" style={{ padding: '1.5rem 1.5rem 1.5rem 4rem', width: '100%' }}>
          <div style={{ fontFamily: 'var(--font-note)', fontSize: '1.1rem', color: 'var(--ink-light)', marginBottom: '1rem' }}>
            Game Settings
          </div>

          {/* Rounds */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
            <span style={{ fontFamily: 'var(--font-hand)', fontSize: '1.1rem', flex: 1 }}>Number of rounds</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn" onClick={() => setRounds(r => Math.max(1, r-1))} style={{ padding: '0.2rem 0.7rem', fontSize: '1.2rem' }}>−</button>
              <span style={{ fontFamily: 'var(--font-note)', fontSize: '1.5rem', fontWeight: 700, minWidth: '30px', textAlign: 'center' }}>{rounds}</span>
              <button className="btn" onClick={() => setRounds(r => Math.min(26, r+1))} style={{ padding: '0.2rem 0.7rem', fontSize: '1.2rem' }}>+</button>
            </div>
          </div>

          {/* Columns */}
          <div>
            <div style={{ fontFamily: 'var(--font-hand)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Columns
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
              {DEFAULT_COLUMNS.map(col => (
                <span key={col} style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.85rem',
                  background: 'var(--ink)', color: 'var(--paper)',
                  padding: '0.2rem 0.7rem', borderRadius: '50px'
                }}>{col}</span>
              ))}
              {customCols.map(col => (
                <span key={col} style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.85rem',
                  background: 'var(--accent2)', color: 'white',
                  padding: '0.2rem 0.7rem', borderRadius: '50px',
                  display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer'
                }} onClick={() => removeColumn(col)}>
                  {col} <span style={{ opacity: 0.8 }}>×</span>
                </span>
              ))}
            </div>
            {customCols.length < 5 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="hand-input"
                  value={newCol}
                  onChange={e => setNewCol(e.target.value)}
                  placeholder="Add column (e.g. Fruit)"
                  onKeyDown={e => e.key === 'Enter' && addColumn()}
                  style={{ flex: 1 }}
                />
                <button className="btn" onClick={addColumn} style={{ padding: '0.3rem 0.8rem' }}>+ Add</button>
              </div>
            )}
            {customCols.length >= 5 && (
              <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.85rem', color: 'var(--ink-light)', fontStyle: 'italic' }}>
                Max 5 custom columns reached
              </div>
            )}
          </div>
        </div>
      )}

      {/* Columns preview for non-host */}
      {!isHost && (
        <div className="notebook-page" style={{ padding: '1rem 1rem 1rem 4rem', width: '100%' }}>
          <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.95rem', color: 'var(--ink-light)', fontStyle: 'italic' }}>
            Waiting for host to start the game...
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Columns: {[...DEFAULT_COLUMNS, ...customCols].join(' · ')}
          </div>
        </div>
      )}

      {/* Start button */}
      {isHost && (
        <button 
          className="btn btn-primary" 
          onClick={handleStart}
          disabled={players.length < 1}
          style={{ fontSize: '1.3rem', padding: '0.8rem 2.5rem', width: '100%', maxWidth: '300px' }}
        >
          🎮 Start Game!
        </button>
      )}
    </div>
  );
}
