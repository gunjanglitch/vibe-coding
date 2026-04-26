export const DEFAULT_COLUMNS = ['Name', 'Place', 'Animal', 'Thing'];

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const LETTER_CYCLE_SPEED = 120; // ms per letter

export const COUNTDOWN_SECONDS = 10;

export const WINNER_LINES = [
  "{winner} clearly ate alphabet soup for breakfast today! 🍜",
  "{winner} is built different. Absolute dictionary energy. 📖",
  "{winner} has been secretly studying encyclopedias. We see you. 👀",
  "{winner} came here to WIN and didn't miss. Respect. 👑",
  "{winner} must have a PhD in Name Place Animal Thing. Unreal.",
  "Someone tell {winner}'s mom, their kid is a genius. 🧠",
  "{winner} — the letters feared them today. Rightfully so.",
  "Is {winner} even human?! That was DOMINANT. 🔥",
];

export const LOSER_LINES = [
  "Don't worry {loser}, Google is free. Just saying. 🙏",
  "{loser} — the alphabet called, it wants its letters back. 😂",
  "{loser} probably thought '{letter}' stood for 'Maybe I'll try next time'.",
  "{loser} was clearly too busy admiring everyone else's answers.",
  "{loser} will help everyone study the dictionary before the next round. 📚",
  "Legend says {loser} is still thinking of a word. Take your time. ⏳",
  "{loser} showed up and that's what matters. Probably. 😬",
  "{loser} — participation is also a skill. You nailed that. 🌟",
];

export const CLOSE_LINES = [
  "{second} was SO close to beating {winner}. Heartbreaking, really. 💔",
  "Only {diff} points between {winner} and {second}. A tragedy in slow motion.",
  "{second} came for the crown and almost got it. Almost. 😤",
];

export const getWinnerLine = (winner) => {
  const lines = WINNER_LINES;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.replace('{winner}', winner);
};

export const getLoserLine = (loser, letter = '') => {
  const lines = LOSER_LINES;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.replace('{loser}', loser).replace('{letter}', letter);
};

export const getCloseLine = (winner, second, diff) => {
  const lines = CLOSE_LINES;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.replace('{winner}', winner).replace('{second}', second).replace('{diff}', diff);
};

export const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};
