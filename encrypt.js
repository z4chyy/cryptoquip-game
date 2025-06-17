const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccount.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Load plaintext jokes
const rawText = fs.readFileSync('puzzle_inputs.txt', 'utf-8');
const jokes = rawText.split('\n').filter(j => j.trim().length > 0);

function generateDerangedCipherMap() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let shuffled;

  do {
    shuffled = [...alphabet].sort(() => Math.random() - 0.5);
  } while (shuffled.some((ch, i) => ch === alphabet[i]));

  const cipher = {};
  for (let i = 0; i < 26; i++) {
    cipher[alphabet[i]] = shuffled[i];
  }
  return cipher;
}

function applyCipher(text, cipher) {
  return text
    .split('')
    .map(char => {
      const upper = char.toUpperCase();
      return /[A-Z]/.test(upper) ? cipher[upper] : char;
    })
    .join('');
}

function breakIntoLines(text, maxLen = 30) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    if ((line + word).length <= maxLen) {
      line += word + ' ';
    } else {
      lines.push(line.trim());
      line = word + ' ';
    }
  }

  if (line.trim()) lines.push(line.trim());

  return lines;
}

function pickRandomHint(cipher, plainText) {
  const letterPairs = [];

  for (const [original, encrypted] of Object.entries(cipher)) {
    if (plainText.toUpperCase().includes(original)) {
      letterPairs.push({ from: encrypted, to: original });
    }
  }

  if (letterPairs.length === 0) {
    return { fromLetter: '?', toLetter: '?', hint: 'No hint available' };
  }

  const chosen = letterPairs[Math.floor(Math.random() * letterPairs.length)];
  return {
    fromLetter: chosen.from,
    toLetter: chosen.to,
    hint: `${chosen.from} equals ${chosen.to}`
  };
}

// 🔍 Get the latest date from Firestore
async function getNextOpenDate() {
  const snapshot = await db.collection('dailyPuzzles')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limitToLast(1)
    .get();

  let startDate = new Date();
  if (!snapshot.empty) {
    const latestDoc = snapshot.docs[0].id;
    const latestDate = new Date(latestDoc);
    startDate = new Date(latestDate);
    startDate.setDate(latestDate.getDate() + 1);
  } else {
    startDate.setDate(startDate.getDate() + 1);
  }

  return startDate;
}

async function generatePuzzles() {
  const startDate = await getNextOpenDate();
  const puzzles = {};

  jokes.forEach((joke, index) => {
    const cipher = generateDerangedCipherMap();
    const solutionLines = breakIntoLines(joke.toUpperCase());
    const encryptedText = applyCipher(joke, cipher);
    const puzzleLines = breakIntoLines(encryptedText);

    const { fromLetter, toLetter, hint } = pickRandomHint(cipher, joke);

    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const docId = date.toISOString().split('T')[0];

    puzzles[docId] = {
      hint,
      fromLetter,
      toLetter,
      puzzleLines,
      solutionLines
    };
  });

  fs.writeFileSync('puzzles.json', JSON.stringify(puzzles, null, 2));
  console.log(`✅ Generated ${jokes.length} puzzles starting from ${startDate.toISOString().split('T')[0]}`);
}

generatePuzzles();
