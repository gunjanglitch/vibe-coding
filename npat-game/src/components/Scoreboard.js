import React, { useMemo } from 'react';
import { WINNER_LINES, LOSER_LINES } from '../constants';

export default function Scoreboard({ players, isFinal, currentLetter, onNext, onClose, funLineIndex }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  const winnerLine = useMemo(() => {
    if (!winner) return '';
    const idx = (funLineIndex || 0) % WINNER_LINES.length;
    return WINNER_LINES[idx].replace('{winner}', winner.name);
  }, [winner?.id, funLineIndex]);

  const loserLine = useMemo(() => {
    if (!loser || loser.id === winner?.id) return '';
    const idx = (funLineIndex || 0) % LOSER_LINES.length;
    return LOSER_LINES[idx].replace('{loser}', loser.name).replace('{letter}', currentLetter || '');
  }, [loser?.id, winner?.id, funLineIndex]);

  const funLine = loserLine || winnerLine;

  return (
    <div className="scoreboard-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="scoreboard-popup">
        <div className="scoreboard-title">
          {isFinal ? '🏆 Final Scores!' : '📊 Scoreboard'}
        </div>

        {sorted.map((p, i) => (
          <div key={p.id} className={`score-row ${i === 0 ? 'winner' : ''}`}>
            {i === 0
              ? <span className="crown">👑</span>
              : <span style={{ minWidth: '24px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.9rem', color: 'var(--ink-light)' }}>{i + 1}</span>
            }
            <span className="player-name">{p.name}</span>
            <span className="player-score">{p.score}</span>
          </div>
        ))}

        {isFinal && funLine && (
          <div className="fun-line">{funLine}</div>
        )}

        <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
          {!isFinal && onNext && (
            <button className="btn btn-primary" onClick={onNext} style={{ flex: 1 }}>
              Next Round →
            </button>
          )}
          {isFinal && (
            <button className="btn btn-primary" onClick={onClose} style={{ flex: 1 }}>
              🎉 Play Again!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
