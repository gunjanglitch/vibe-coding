import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { DEFAULT_COLUMNS, LETTERS, LETTER_CYCLE_SPEED, COUNTDOWN_SECONDS } from '../constants';
import Scoreboard from './Scoreboard';
import VoiceChat from './VoiceChat';

const PHASE = { LETTER: 'letter', ANSWER: 'answer', RESULTS: 'results' };

export default function GameScreen({ player, room: initialRoom, onRoomUpdate }) {
  const [room, setRoom] = useState(initialRoom);
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState(PHASE.LETTER);
  const [currentLetter, setCurrentLetter] = useState('');
  const [cyclingLetter, setCyclingLetter] = useState('A');
  const [answers, setAnswers] = useState({});
  const [countdown, setCountdown] = useState(null);
  const [locked, setLocked] = useState(false);
  const [myDone, setMyDone] = useState(false);
  const [firstDone, setFirstDone] = useState(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(player.id);
  const [roundAnswers, setRoundAnswers] = useState({});
  const [funLineIndex] = useState(() => Math.floor(Math.random() * 8));
  // Manual marks override by host: { playerId_col: true/false } false = zeroed out
  const [marksOverride, setMarksOverride] = useState({});

  const cycleRef = useRef(null);
  const countdownRef = useRef(null);
  const letterIndexRef = useRef(0);
  const currentLetterRef = useRef('');
  const currentRoundRef = useRef(initialRoom.current_round);
  const firstDoneRef = useRef(null);
  const myDoneRef = useRef(false);
  const answersRef = useRef({});

  const columns = [...DEFAULT_COLUMNS, ...(room.custom_columns || [])];
  const sayer = players[room.sayer_index] || null;
  const stopper = players[room.stopper_index] || null;
  const isSayer = sayer?.id === player.id;
  const isStopper = stopper?.id === player.id;
  const isHost = room.host_id === player.id;
  const isLastRound = room.current_round >= room.total_rounds;
  const allFilled = columns.every(col => (answers[col] || '').trim());

  useEffect(() => {
    fetchPlayers();
    const sub = supabase.channel(`game-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: updated }) => {
        setRoom(updated);
        onRoomUpdate(updated);
        handleRoomUpdate(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, fetchPlayers)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` }, fetchRoundAnswers)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` }, fetchRoundAnswers)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [room.id]);

  useEffect(() => {
    if (phase === PHASE.LETTER && isSayer) startCycling();
    return () => stopCycling();
  }, [phase, isSayer]);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').eq('room_id', room.id).order('joined_at');
    if (data) setPlayers(data);
  };

  const fetchRoundAnswers = async () => {
    const { data } = await supabase.from('answers').select('*').eq('room_id', room.id).eq('round', currentRoundRef.current);
    if (data) {
      const byPlayer = {};
      data.forEach(a => { byPlayer[a.player_id] = a; });
      setRoundAnswers(byPlayer);
      const doneEntry = data.find(a => a.finished_first);
      if (doneEntry && !firstDoneRef.current) {
        firstDoneRef.current = doneEntry.player_id;
        setFirstDone(doneEntry.player_id);
        startCountdown();
      }
    }
  };

  const resetForNewRound = () => {
    stopCycling();
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    answersRef.current = {};
    setAnswers({});
    setLocked(false);
    myDoneRef.current = false;
    setMyDone(false);
    firstDoneRef.current = null;
    setFirstDone(null);
    setCountdown(null);
    setRoundAnswers({});
    setShowScoreboard(false);
    setMarksOverride({});
    setViewingPlayer(player.id);
    setPhase(PHASE.LETTER);
  };

  const handleRoomUpdate = (updated) => {
    // New letter revealed → switch to answer phase
    if (updated.current_letter && updated.current_letter !== currentLetterRef.current) {
      currentLetterRef.current = updated.current_letter;
      setCurrentLetter(updated.current_letter);
      setPhase(PHASE.ANSWER);
      stopCycling();
      answersRef.current = {};
      setAnswers({});
      setLocked(false);
      myDoneRef.current = false;
      setMyDone(false);
      firstDoneRef.current = null;
      setFirstDone(null);
      setCountdown(null);
      setRoundAnswers({});
    }

    // ✅ FIX: host moved to next round → all non-host players reset and go back to letter phase
    if (
      updated.current_round > currentRoundRef.current &&
      updated.status === 'playing' &&
      (!updated.current_letter || updated.current_letter === null || updated.current_letter === '')
    ) {
      currentRoundRef.current = updated.current_round;
      currentLetterRef.current = '';
      setCurrentLetter('');
      resetForNewRound();
    }
  };

  const startCycling = () => {
    stopCycling();
    cycleRef.current = setInterval(() => {
      letterIndexRef.current = (letterIndexRef.current + 1) % LETTERS.length;
      setCyclingLetter(LETTERS[letterIndexRef.current]);
    }, LETTER_CYCLE_SPEED);
  };

  const stopCycling = () => {
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
  };

  const handleStop = async () => {
    if (!isStopper) return;
    stopCycling();
    const letter = LETTERS[letterIndexRef.current];
    await supabase.from('rooms').update({ current_letter: letter }).eq('id', room.id);
  };

  const handleAnswerChange = useCallback((col, val) => {
    answersRef.current = { ...answersRef.current, [col]: val };
    setAnswers(prev => ({ ...prev, [col]: val }));
  }, []);

  const handleDone = async () => {
    if (myDoneRef.current || locked) return;
    myDoneRef.current = true;
    setMyDone(true);
    const isFirst = !firstDoneRef.current;
    const currentAnswers = answersRef.current;
    const { data: existing } = await supabase.from('answers').select('id').eq('room_id', room.id).eq('player_id', player.id).eq('round', room.current_round).single();
    if (existing) {
      await supabase.from('answers').update({ answers: currentAnswers, finished_first: isFirst, submitted_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('answers').insert({ room_id: room.id, player_id: player.id, round: room.current_round, letter: currentLetterRef.current, answers: currentAnswers, finished_first: isFirst });
    }
    if (isFirst) {
      firstDoneRef.current = player.id;
      setFirstDone(player.id);
      startCountdown();
    }
  };

  const startCountdown = () => {
    if (countdownRef.current) return;
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = async () => {
    setLocked(true);
    if (!myDoneRef.current) {
      const currentAnswers = answersRef.current;
      const { data: existing } = await supabase.from('answers').select('id').eq('room_id', room.id).eq('player_id', player.id).eq('round', room.current_round).single();
      if (existing) {
        await supabase.from('answers').update({ answers: currentAnswers, submitted_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('answers').insert({ room_id: room.id, player_id: player.id, round: room.current_round, letter: currentLetterRef.current, answers: currentAnswers, finished_first: false });
      }
    }
    await calculateScores();
  };

  const calculateScores = async (overrides = {}) => {
    const { data: roundData } = await supabase.from('answers').select('*').eq('room_id', room.id).eq('round', room.current_round);
    if (!roundData) return;
    const scoreUpdates = {};
    columns.forEach(col => {
      const colAnswers = roundData.map(r => (r.answers?.[col] || '').trim().toLowerCase()).filter(Boolean);
      roundData.forEach(r => {
        const key = `${r.player_id}_${col}`;
        // If host zeroed this answer out, give 0
        if (overrides[key] === false) return;
        const ans = (r.answers?.[col] || '').trim().toLowerCase();
        if (!ans) return;
        const count = colAnswers.filter(a => a === ans).length;
        scoreUpdates[r.player_id] = (scoreUpdates[r.player_id] || 0) + (count === 1 ? 10 : 5);
      });
    });
    const firstEntry = roundData.find(r => r.finished_first);
    if (firstEntry) scoreUpdates[firstEntry.player_id] = (scoreUpdates[firstEntry.player_id] || 0) + 5;
    for (const r of roundData) {
      await supabase.from('answers').update({ total_marks: scoreUpdates[r.player_id] || 0 }).eq('id', r.id);
    }
    const { data: currentPlayers } = await supabase.from('players').select('*').eq('room_id', room.id);
    for (const p of (currentPlayers || [])) {
      await supabase.from('players').update({ score: p.score + (scoreUpdates[p.id] || 0) }).eq('id', p.id);
    }
    await fetchPlayers();
    setPhase(PHASE.RESULTS);
  };

  // Host toggles a specific answer cell to 0
  const toggleMarkOverride = (playerId, col) => {
    const key = `${playerId}_${col}`;
    setMarksOverride(prev => ({ ...prev, [key]: prev[key] === false ? undefined : false }));
  };

  // Host confirms marks and recalculates
  const handleConfirmMarks = async () => {
    // Reset player scores for this round first, then recalculate
    const { data: currentPlayers } = await supabase.from('players').select('*').eq('room_id', room.id);
    const { data: roundData } = await supabase.from('answers').select('*').eq('room_id', room.id).eq('round', room.current_round);
    // Subtract previously added marks
    for (const r of (roundData || [])) {
      const p = currentPlayers?.find(p => p.id === r.player_id);
      if (p) await supabase.from('players').update({ score: Math.max(0, p.score - (r.total_marks || 0)) }).eq('id', p.id);
    }
    await calculateScores(marksOverride);
  };

  const handleNextRound = async () => {
    const nextRound = room.current_round + 1;
    const newSayerIdx = (room.sayer_index + 1) % players.length;
    const newStopperIdx = (newSayerIdx + 1) % players.length;
    // Reset current_letter to empty string so handleRoomUpdate on other clients detects new round
    await supabase.from('rooms').update({
      current_round: nextRound,
      current_letter: '',
      sayer_index: newSayerIdx,
      stopper_index: newStopperIdx,
      status: 'playing',
    }).eq('id', room.id);
    // Host also resets locally
    currentRoundRef.current = nextRound;
    currentLetterRef.current = '';
    setCurrentLetter('');
    resetForNewRound();
  };

  /* ===================== RENDER ===================== */
  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '0.6rem', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>

      {/* STATUS PILL */}
      <div style={{
        width: '100%', maxWidth: 680,
        background: '#fffde8',
        border: '1.5px dashed #c9c07a',
        borderRadius: 8,
        padding: '0.45rem 0.9rem',
        fontFamily: 'var(--font-note)',
        fontSize: '0.88rem',
        color: '#444466',
        fontStyle: 'italic',
        textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
      }}>
        {phase === PHASE.LETTER && sayer && stopper &&
          <>🎲 <strong>{sayer.name}</strong> is thinking… <strong>{stopper.name}</strong> will stop!</>}
        {phase === PHASE.ANSWER && countdown === null &&
          <>✏️ Letter is <strong style={{ fontSize: '1rem' }}>{currentLetter}</strong> — write fast! First to finish gets <strong>+5 🏆</strong></>}
        {phase === PHASE.ANSWER && countdown !== null && (
          <>
            <span>{firstDone ? `${players.find(p => p.id === firstDone)?.name} finished first! +5 🏆` : 'Time running out!'}</span>
            <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: '1.2rem', color: '#e63946', minWidth: 36 }}>{countdown}s</span>
          </>
        )}
        {phase === PHASE.RESULTS && <>📋 Round {room.current_round} done — check answers below</>}
      </div>

      {/* LETTER PHASE */}
      {phase === PHASE.LETTER && (
        <div style={{
          width: '100%', maxWidth: 380,
          background: '#fefde8',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #a8d5e2 39px, #a8d5e2 40px)',
          border: '2px solid #c9c07a',
          borderRadius: 4,
          boxShadow: '3px 3px 0 #c9b882, 6px 6px 0 #b8a870',
          padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
          minHeight: 220, justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
              {isSayer ? 'Only you can see this 👁️' : isStopper ? 'Hit STOP whenever you want!' : `Waiting for ${stopper?.name || '...'} to stop`}
            </div>
            <div style={{
              fontFamily: 'var(--font-note)', fontSize: '7rem', fontWeight: 700,
              lineHeight: 1, color: '#1a1a2e', opacity: isSayer ? 1 : 0.15, userSelect: 'none',
            }}>
              {isSayer ? cyclingLetter : '?'}
            </div>
          </div>
          {isStopper && (
            <button className="btn-stop" onClick={handleStop} style={{ fontSize: '1.6rem', padding: '1rem 2.5rem' }}>
              STOP!
            </button>
          )}
          {!isSayer && !isStopper && (
            <div style={{ fontFamily: 'var(--font-note)', color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Waiting for <strong>{stopper?.name}</strong> to stop…
            </div>
          )}
        </div>
      )}

      {/* ANSWER / RESULTS PHASE */}
      {(phase === PHASE.ANSWER || phase === PHASE.RESULTS) && (
        <div style={{ width: '100%', maxWidth: 700 }}>

          {/* Player tabs */}
          {phase === PHASE.RESULTS && (
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, marginBottom: -2, WebkitOverflowScrolling: 'touch' }}>
              {players.map(p => (
                <button key={p.id} onClick={() => setViewingPlayer(p.id)} style={{
                  fontFamily: 'var(--font-hand)', fontSize: '0.85rem',
                  padding: '0.25rem 0.9rem',
                  background: viewingPlayer === p.id ? '#fefde8' : '#f0e8c8',
                  border: '2px solid #c9c07a',
                  borderBottom: viewingPlayer === p.id ? '2px solid #fefde8' : '2px solid #c9c07a',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  fontWeight: viewingPlayer === p.id ? 700 : 400,
                  color: viewingPlayer === p.id ? '#1a1a2e' : '#666',
                }}>
                  {p.name}{p.id === player.id ? ' ✏️' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Notebook card */}
          <div style={{
            background: '#fefde8',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #a8d5e2 39px, #a8d5e2 40px)',
            border: '2px solid #c9c07a',
            borderRadius: phase === PHASE.RESULTS ? '0 4px 4px 4px' : 4,
            boxShadow: '3px 3px 0 #c9b882, 5px 5px 0 #b8a870',
            overflow: 'hidden',
          }}>

            {/* NOTEBOOK HEADER */}
            <div style={{
              borderBottom: '2px solid #1a1a2e',
              padding: '0.5rem 0.8rem',
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(255,253,232,0.95)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {room.name}
                </div>
                <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.72rem', color: '#888' }}>
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 0.3rem' }}>
                <div style={{ fontFamily: 'var(--font-note)', fontSize: '2.8rem', fontWeight: 700, lineHeight: 1, color: '#1a1a2e' }}>
                  {currentLetter || '?'}
                </div>
                <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.68rem', color: '#888', whiteSpace: 'nowrap' }}>
                  Round {room.current_round}/{room.total_rounds}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-note)', fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {players.find(p => p.id === viewingPlayer)?.name || player.name}
              </div>
            </div>

            {/* ANSWER GRID */}
            <div style={{ padding: '0.5rem 0.8rem 0.8rem' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `44px repeat(${columns.length}, 1fr)`,
                gap: '0 0.4rem',
                marginBottom: '0.3rem',
                borderBottom: '1px solid #1a1a2e',
                paddingBottom: '0.3rem',
              }}>
                <div style={{ fontFamily: 'var(--font-note)', fontSize: '0.72rem', color: '#888' }}>Marks</div>
                {columns.map(col => (
                  <div key={col} style={{ fontFamily: 'var(--font-note)', fontSize: '0.82rem', fontWeight: 700, color: '#1a1a2e' }}>{col}</div>
                ))}
              </div>

              {/* Answer row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `44px repeat(${columns.length}, 1fr)`,
                gap: '0 0.4rem',
                alignItems: 'end',
              }}>
                {/* Marks */}
                <div style={{
                  fontFamily: 'var(--font-note)', fontSize: '0.9rem', fontWeight: 700,
                  color: '#457b9d', paddingBottom: '0.25rem',
                  borderBottom: '1px solid #a8d5e2',
                  minHeight: 32, display: 'flex', alignItems: 'flex-end',
                }}>
                  {phase === PHASE.RESULTS && roundAnswers[viewingPlayer]
                    ? (() => {
                        // Recalc display marks with overrides
                        const r = roundAnswers[viewingPlayer];
                        if (!r) return '';
                        let base = r.total_marks || 0;
                        // Subtract zeroed cols (each unique = 10, common = 5 — approximate 10 per zeroed)
                        Object.entries(marksOverride).forEach(([key, val]) => {
                          if (val === false && key.startsWith(viewingPlayer)) base = Math.max(0, base - 10);
                        });
                        return base;
                      })()
                    : ''
                  }
                </div>

                {/* Answer cells */}
                {columns.map(col => {
                  const isMe = viewingPlayer === player.id;
                  const val = isMe ? (answers[col] || '') : (roundAnswers[viewingPlayer]?.answers?.[col] || '');
                  const overrideKey = `${viewingPlayer}_${col}`;
                  const isZeroed = marksOverride[overrideKey] === false;

                  return (
                    <div key={col} style={{
                      borderBottom: '1px solid #a8d5e2',
                      minHeight: 32,
                      position: 'relative',
                      background: isZeroed ? 'rgba(230,57,70,0.08)' : 'transparent',
                    }}>
                      {isMe && phase === PHASE.ANSWER ? (
                        <input
                          value={val}
                          onChange={e => handleAnswerChange(col, e.target.value)}
                          disabled={locked}
                          placeholder={col}
                          autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck="false"
                          style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            fontFamily: 'var(--font-hand)', fontSize: '1rem',
                            color: locked ? '#e63946' : '#1a1a2e',
                            padding: '0.25rem 0.2rem', cursor: locked ? 'not-allowed' : 'text',
                          }}
                        />
                      ) : (
                        <div style={{
                          fontFamily: 'var(--font-hand)', fontSize: '1rem',
                          color: isZeroed ? '#e63946' : '#1a1a2e',
                          padding: '0.25rem 0.2rem', minHeight: 32,
                          textDecoration: isZeroed ? 'line-through' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span>{val}</span>
                          {/* Host can tap any answer cell to zero it out */}
                          {isHost && phase === PHASE.RESULTS && val && (
                            <button
                              onClick={() => toggleMarkOverride(viewingPlayer, col)}
                              title={isZeroed ? 'Restore mark' : 'Zero this answer'}
                              style={{
                                background: isZeroed ? '#2a9d8f' : '#e63946',
                                color: 'white', border: 'none',
                                borderRadius: 3, fontSize: '0.65rem',
                                padding: '1px 5px', cursor: 'pointer',
                                marginLeft: 4, flexShrink: 0,
                              }}>
                              {isZeroed ? '✓' : '✗'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FOOTER */}
            <div style={{
              borderTop: '1px dashed #c9c07a',
              padding: '0.6rem 0.8rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              {/* Left — done/status */}
              <div>
                {phase === PHASE.ANSWER && !myDone && !locked && (
                  <button className="btn btn-done" onClick={handleDone}
                    disabled={!allFilled} style={{ opacity: allFilled ? 1 : 0.45, fontSize: '1rem', padding: '0.5rem 1.4rem' }}>
                    ✅ Done!
                  </button>
                )}
                {phase === PHASE.ANSWER && myDone && !locked && (
                  <span style={{ fontFamily: 'var(--font-note)', color: '#2a9d8f', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    ✅ Submitted! Waiting…
                  </span>
                )}
                {phase === PHASE.ANSWER && locked && (
                  <span style={{ fontFamily: 'var(--font-note)', color: '#e63946', fontSize: '0.9rem', fontWeight: 700 }}>
                    🔒 Locked!
                  </span>
                )}

                {/* Host confirm marks button */}
                {isHost && phase === PHASE.RESULTS && Object.values(marksOverride).some(v => v === false) && (
                  <button className="btn btn-danger" onClick={handleConfirmMarks}
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}>
                    ✓ Confirm Marks
                  </button>
                )}
              </div>

              {/* Right — scores / next */}
              {phase === PHASE.RESULTS && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" onClick={() => setShowScoreboard(true)}
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}>
                    📊 Scores
                  </button>
                  {isLastRound ? (
                    <button className="btn btn-primary" onClick={() => setShowScoreboard(true)}
                      style={{ fontSize: '0.82rem', padding: '0.35rem 0.9rem' }}>
                      🏆 Final!
                    </button>
                  ) : (
                    isHost && (
                      <button className="btn btn-primary" onClick={handleNextRound}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.9rem' }}>
                        Next Round →
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Host hint for zeroing marks */}
          {isHost && phase === PHASE.RESULTS && (
            <div style={{
              marginTop: '0.4rem', textAlign: 'center',
              fontFamily: 'var(--font-note)', fontSize: '0.75rem',
              color: '#888', fontStyle: 'italic'
            }}>
              Host: tap ✗ on any answer to mark it as invalid (zero marks)
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      {showScoreboard && (
        <Scoreboard
          players={players}
          isFinal={isLastRound}
          currentLetter={currentLetter}
          funLineIndex={funLineIndex}
          onNext={!isLastRound && isHost ? handleNextRound : null}
          onClose={() => {
            if (isLastRound) window.location.reload();
            else setShowScoreboard(false);
          }}
        />
      )}

      <VoiceChat roomId={room.id} playerName={player.name} />
    </div>
  );
}
