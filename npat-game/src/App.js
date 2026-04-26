import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import { supabase } from './supabase';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [player, setPlayer] = useState(null);   // { id, name }
  const [room, setRoom] = useState(null);        // room data
  const [players, setPlayers] = useState([]);

  // Generate or restore player ID
  useEffect(() => {
    let pid = localStorage.getItem('npat_player_id');
    if (!pid) { pid = uuidv4(); localStorage.setItem('npat_player_id', pid); }
    const pname = localStorage.getItem('npat_player_name') || '';
    setPlayer({ id: pid, name: pname });
  }, []);

  const handleJoinRoom = async (roomId, playerName) => {
    localStorage.setItem('npat_player_name', playerName);
    setPlayer(prev => ({ ...prev, name: playerName }));

    // Upsert player into room
    await supabase.from('players').upsert({
      id: player?.id || uuidv4(),
      room_id: roomId,
      name: playerName,
      score: 0,
      is_ready: false,
      is_done: false,
    });

    // Fetch room data
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    setRoom(roomData);
    setScreen('lobby');
  };

  const handleGameStart = (roomData) => {
    setRoom(roomData);
    setScreen('game');
  };

  const handleRoomUpdate = (roomData) => {
    setRoom(roomData);
    if (roomData.status === 'playing' && screen === 'lobby') {
      setScreen('game');
    }
  };

  if (!player) return <div className="loading">Loading...</div>;

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen player={player} onJoinRoom={handleJoinRoom} />
      )}
      {screen === 'lobby' && (
        <LobbyScreen
          player={player}
          room={room}
          onGameStart={handleGameStart}
          onRoomUpdate={handleRoomUpdate}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          player={player}
          room={room}
          onRoomUpdate={handleRoomUpdate}
        />
      )}
    </div>
  );
}
