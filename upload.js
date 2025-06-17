const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./serviceAccount.json');
const puzzles = require('./puzzles.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function uploadPuzzles() {
  const puzzleDates = Object.keys(puzzles);
  let uploaded = 0, skipped = 0;

  for (const date of puzzleDates) {
    const docRef = db.collection('dailyPuzzles').doc(date);
    const doc = await docRef.get();

    if (doc.exists) {
      console.log(`⏭️ Skipped ${date} (already exists)`);
      skipped++;
    } else {
      await docRef.set(puzzles[date]);
      console.log(`✅ Uploaded puzzle for ${date}`);
      uploaded++;
    }
  }

  console.log(`\n🎉 All done: ${uploaded} uploaded, ${skipped} skipped.`);
}

uploadPuzzles();
