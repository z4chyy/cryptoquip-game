// Game state variables to be populated from Firestore
    let puzzleLines = [];
    let solutionLines = [];
    let blanks = [];
    let currentHintText = "";
    let currentFromLetter = "";
    let currentToLetter = "";

    let history = [];
    let hintCount = 0;
    let isChecked = false;
    // Admin keys can remain as they are not puzzle specific
    let adminKeys = [];
    const ADMIN_CODE = ['Shift', 'Z', 'A', 'C', 'H', 'Y'];


    async function fetchAndInitializePuzzle() {
      const puzzleArea = document.getElementById('puzzle-area');
      const dateDisplay = document.getElementById('date');

      if (!window.fb_db || !window.fb_doc || !window.fb_getDoc) {
        console.error("Firestore is not initialized yet.");
        if (puzzleArea) puzzleArea.innerHTML = '<p style="color:red;">Error: Could not load puzzle. Firestore not ready. Please try refreshing.</p>';
        return;
      }

const params = new URLSearchParams(window.location.search);
const testDate = params.get('testdate');
let documentIdByDate;

const today = new Date(); // ✅ Must be defined for both cases

if (testDate && /^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
  documentIdByDate = testDate;
  console.log("🧪 Loading puzzle for test date:", testDate);
  if (dateDisplay) {
    dateDisplay.textContent = `Testing Puzzle for: ${testDate}`;
  }
} else {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  documentIdByDate = `${year}-${month}-${day}`;
  if (dateDisplay) {
    dateDisplay.textContent = today.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}




      if (dateDisplay) {
        dateDisplay.textContent = today.toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      const puzzleDocRef = window.fb_doc(window.fb_db, "dailyPuzzles", documentIdByDate);

      try {
        const docSnap = await window.fb_getDoc(puzzleDocRef);

        if (docSnap.exists()) {
          const puzzleData = docSnap.data();

          puzzleLines = puzzleData.puzzleLines || [];
          solutionLines = puzzleData.solutionLines || [];
          currentHintText = puzzleData.hint || "";
          currentFromLetter = puzzleData.fromLetter || "";
          currentToLetter = puzzleData.toLetter || "";

          if (puzzleLines.length === 0) {
            console.error(`Fetched puzzle for ${documentIdByDate} has no lines.`);
            if (puzzleArea) puzzleArea.innerHTML = `<p style="color:red;">Error: Puzzle data for ${documentIdByDate} is empty or invalid.</p>`;
            return;
          }

          blanks = puzzleLines.map(line => line.split('').map(ch => /[A-Z]/.test(ch) ? '_' : ch));
          history = [];

          const hintContainer = document.querySelector('.hint');
          if (hintContainer) {
            hintContainer.innerHTML = `<strong>Today's Hint:</strong> ${currentHintText}`;
          }

          const fromInputElement = document.getElementById('from');
          const toInputElement = document.getElementById('to');
          if (fromInputElement) fromInputElement.placeholder = currentFromLetter;
          if (toInputElement) toInputElement.placeholder = currentToLetter;

          displayPuzzle();
          updateAlphabetGrid();

        } else {
          console.error(`No puzzle document found for date: ${documentIdByDate}`);
          if (puzzleArea) puzzleArea.innerHTML = `<p style="color:red;">Error: Today's puzzle (${documentIdByDate}) not found. Please check back later.</p>`;
        }
      } catch (error) {
        console.error("Error fetching puzzle for " + documentIdByDate + ":", error);
        if (puzzleArea) puzzleArea.innerHTML = '<p style="color:red;">Error: Could not load puzzle. Please try refreshing.</p>';
      }
    }

    // Core game functions (remain largely the same, but use global vars populated by fetch)
    function displayPuzzle() {
      const puzzleArea = document.getElementById('puzzle-area');
      if (!puzzleArea) return; // Guard against null
      puzzleArea.innerHTML = '';


      puzzleLines.forEach((line, idx) => {
        const block = document.createElement('div');
        block.classList.add('puzzle-block');

        const puzzleLineDiv = document.createElement('div');
        puzzleLineDiv.classList.add('puzzle-line');
        puzzleLineDiv.textContent = line; // Using textContent for safety

        let blanksLineHTML = "";
        blanks[idx].forEach(ch => {
          if (typeof ch === 'string' && ch.startsWith('<span')) { // If it's already a span (from check/hint)
            blanksLineHTML += ch;
          } else if (ch !== '_') {
            blanksLineHTML += `<span class='entered-letter'>${ch}</span>`;
          } else {
            blanksLineHTML += '_';
          }
        });
        const blanksLineDiv = document.createElement('div');
        blanksLineDiv.classList.add('blanks-line');
        blanksLineDiv.innerHTML = blanksLineHTML;


        block.appendChild(puzzleLineDiv);
        block.appendChild(blanksLineDiv);
        puzzleArea.appendChild(block);
      });
    }

    function updateAlphabetGrid() {
      document.querySelectorAll('.guess-row > div').forEach(cell => {
        cell.textContent = '?';
        cell.className = ''; // Clear classes like correct, incorrect, hint
        // Keep data-letter attribute: cell.dataset.letter = cell.dataset.letter;
      });

      puzzleLines.forEach((line, row) => {
        if (!blanks[row]) return; // Guard if blanks isn't fully initialized
        line.split('').forEach((cipherChar, col) => {
          if (/[A-Z]/.test(cipherChar)) {
            const guess = blanks[row][col];
            if (guess !== '_') {
              // Extract text if guess is a span, otherwise use as is
              let guessedLetter = guess;
              if (typeof guess === 'string' && guess.includes('<span')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = guess;
                guessedLetter = tempDiv.textContent || tempDiv.innerText || '';
              }

              const cell = document.querySelector(`.guess-row > div[data-letter="${cipherChar}"]`);

              if (cell) {
                cell.textContent = guessedLetter;

                // Add class based on the span's class if present
                if (typeof guess === 'string') {
                    if (guess.includes('correct-guess')) cell.classList.add('correct');
                    else if (guess.includes('incorrect-guess')) cell.classList.add('incorrect');
                    else if (guess.includes('hint-letter')) cell.classList.add('hint');
                }
              }
            }
          }
        });
      });
    }

    function checkPuzzleComplete() {
      if (puzzleLines.length === 0 || solutionLines.length === 0) return false; // Not loaded yet
      for (let idx = 0; idx < puzzleLines.length; idx++) {
        for (let cidx = 0; cidx < puzzleLines[idx].length; cidx++) {
          if (!/[A-Z]/.test(puzzleLines[idx][cidx])) continue;

          const userCharEntry = blanks[idx][cidx];
          if (userCharEntry === '_') return false;

          let actualUserChar;
          if (typeof userCharEntry === 'string' && userCharEntry.includes('span')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = userCharEntry;
            actualUserChar = tempDiv.textContent || tempDiv.innerText;
          } else {
            actualUserChar = userCharEntry;
          }

          if (actualUserChar.trim() !== solutionLines[idx][cidx]) {
            return false;
          }
        }
      }
      return true;
    }

    function substitute() {
      const from = document.getElementById('from').value.toUpperCase();
      const to = document.getElementById('to').value.toUpperCase();
      const error = document.getElementById('error');
      error.textContent = '';

      if (!from || !to) {
        error.textContent = "Both fields required.";
        shakeInputs();
        return;
      }

      for (let i = 0; i < blanks.length; i++) {
        for (let j = 0; j < blanks[i].length; j++) {
          const val = blanks[i][j];
          // Simpler check: if current cell's plain text content is 'to'
          let cellText = val;
          if (typeof val === 'string' && val.includes('<span')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = val;
            cellText = tempDiv.textContent || tempDiv.innerText;
          }
          if (cellText === to) {
            error.textContent = `${to} is already assigned. Try another letter.`;
            shakeInputs();
            return;
          }
        }
      }

      history.push(JSON.parse(JSON.stringify(blanks)));

      puzzleLines.forEach((line, idx) => {
        line.split('').forEach((ch, cidx) => {
          if (ch === from) blanks[idx][cidx] = `<span class='entered-letter'>${to}</span>`;
        });
      });

      updateAlphabetGrid();
      displayPuzzle();

      document.getElementById('from').value = '';
      document.getElementById('to').value = '';
      document.getElementById('from').focus();

      if (checkPuzzleComplete()) {
        showCongratulationsPopup();
      }
    }

    function toggleCheck() {
      if (!isChecked) {
        blanks = blanks.map((line, idx) =>
          line.map((ch, cidx) => {
            if (typeof ch === 'string' && ch.includes('hint-letter')) return ch;

            const userChar = (typeof ch === 'string' && ch.includes('<span')) ?
                             (new DOMParser().parseFromString(ch, 'text/html')).body.textContent : ch;
            const correctChar = solutionLines[idx][cidx];

            if (userChar === '_') return '_';
            if (userChar === correctChar) return `<span class='correct-guess'>${userChar}</span>`;
            return `<span class='incorrect-guess'>${userChar}</span>`;
          })
        );
        isChecked = true;
        document.getElementById('check-btn').textContent = 'Uncheck';
      } else {
        blanks = blanks.map(line =>
          line.map(ch => {
            if (typeof ch === 'string' && ch.includes('hint-letter')) return ch;
            const userChar = (typeof ch === 'string' && ch.includes('<span')) ?
                             (new DOMParser().parseFromString(ch, 'text/html')).body.textContent : ch;
            if (userChar === '_') return '_';
            return `<span class='entered-letter'>${userChar}</span>`;
          })
        );
        isChecked = false;
        document.getElementById('check-btn').textContent = 'Check';
      }
      updateAlphabetGrid();
      displayPuzzle();
      if (checkPuzzleComplete()) showCongratulationsPopup();
    }

    function getRandomUnsolvedLetter() {
      const unsolved = [];
      for (let i = 0; i < puzzleLines.length; i++) {
        for (let j = 0; j < puzzleLines[i].length; j++) {
          if (/[A-Z]/.test(puzzleLines[i][j]) && (blanks[i][j] === '_' || (typeof blanks[i][j] === 'string' && blanks[i][j].includes('_')))) { // Check if it's placeholder or contains it
            unsolved.push({i, j});
          }
        }
      }
      return unsolved.length > 0 ? unsolved[Math.floor(Math.random() * unsolved.length)] : null;
    }

    function checkAdminCode(e) {
      adminKeys.push(e.key);
      if (adminKeys.length > ADMIN_CODE.length) adminKeys.shift();
      if (adminKeys.length === ADMIN_CODE.length && adminKeys.every((key, i) => key === ADMIN_CODE[i])) {
        adminCompletePuzzle();
        adminKeys = [];
      }
    }

    function adminCompletePuzzle() {
      history.push(JSON.parse(JSON.stringify(blanks)));
      const leaveUnsolved = getRandomUnsolvedLetter();
      for (let i = 0; i < puzzleLines.length; i++) {
        for (let j = 0; j < puzzleLines[i].length; j++) {
          if (/[A-Z]/.test(puzzleLines[i][j])) {
            if (leaveUnsolved && i === leaveUnsolved.i && j === leaveUnsolved.j) continue;
            blanks[i][j] = `<span class='entered-letter'>${solutionLines[i][j]}</span>`;
          }
        }
      }
      displayPuzzle();
      updateAlphabetGrid(); // Ensure alphabet grid updates
      if (!leaveUnsolved && checkPuzzleComplete()) showCongratulationsPopup();
    }

    function shakeInputs() {
      const fromBox = document.getElementById('from');
      const toBox = document.getElementById('to');
      [fromBox, toBox].forEach(box => {
        box.classList.add('shake');
        setTimeout(() => box.classList.remove('shake'), 300);
      });
    }

    function showCongratulationsPopup() {
      const popup = document.getElementById('congrats-popup');
      const statsElement = document.getElementById('popup-stats');
      const quoteElement = document.getElementById('popup-quote');

      statsElement.innerHTML = `Hints Used: ${hintCount}`;
      quoteElement.innerHTML = solutionLines.join('<br>'); // Use solutionLines from Firestore
      popup.style.display = 'flex';
    }

    function closePopup() {
      document.getElementById('congrats-popup').style.display = 'none';
    }

    function showResetConfirmation() {
      document.getElementById('reset-confirmation').style.display = 'block';
    }

    function confirmReset() {
      // Re-initialize blanks based on current puzzleLines (from Firestore)
      blanks = puzzleLines.map(line => line.split('').map(ch => /[A-Z]/.test(ch) ? '_' : ch));
      history = [];
      hintCount = 0; // Reset hint count on full reset
      document.getElementById('hint-counter').textContent = `Hints Used: ${hintCount}`;
      isChecked = false; // Reset check state
      document.getElementById('check-btn').textContent = 'Check';
      displayPuzzle();
      updateAlphabetGrid();
      document.getElementById('reset-confirmation').style.display = 'none';
    }

    function cancelReset() {
      document.getElementById('reset-confirmation').style.display = 'none';
    }

    function undoLast() {
      if (history.length) {
        blanks = history.pop();
        displayPuzzle();
        updateAlphabetGrid(); // Update alphabet grid on undo
      }
    }

    function showHintConfirmation() {
      document.getElementById('hint-confirmation').style.display = 'block';
    }

    function cancelHint() {
      document.getElementById('hint-confirmation').style.display = 'none';
    }

    function applyHint() {
      outer: for (let idx = 0; idx < puzzleLines.length; idx++) {
        for (let cidx = 0; cidx < puzzleLines[idx].length; cidx++) {
          // Check if the current blank is truly unsolved ('_')
          if (blanks[idx][cidx] === '_' && /[A-Z]/.test(puzzleLines[idx][cidx])) {
            let targetChar = puzzleLines[idx][cidx]; // The cipher char we want to reveal
            let solutionChar = solutionLines[idx][cidx]; // The solution for this char

            // Apply this hint to all instances of targetChar
            for (let i = 0; i < puzzleLines.length; i++) {
              for (let j = 0; j < puzzleLines[i].length; j++) {
                if (puzzleLines[i][j] === targetChar && blanks[i][j] === '_') { // Only fill if unsolved
                  blanks[i][j] = `<span class='hint-letter'>${solutionChar}</span>`;
                }
              }
            }
            hintCount++;
            document.getElementById('hint-counter').textContent = `Hints Used: ${hintCount}`;
            displayPuzzle();
            updateAlphabetGrid(); // Update alphabet grid after hint
            document.getElementById('hint-confirmation').style.display = 'none';

            if (checkPuzzleComplete()) {
              showCongratulationsPopup();
            }
            return; // Exit after applying one hint
          }
        }
      }
      // If loop completes, no suitable blank was found (e.g., all filled or hints conflict)
      document.getElementById('hint-confirmation').style.display = 'none';
      // Optionally, inform user no hint could be applied
    }

    function toggleHowToPlay() {
      const popup = document.getElementById('how-to-play-popup');
      popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
    }

    function closeHTP() {
      document.getElementById('how-to-play-popup').style.display = 'none';
    }

    async function shareResults() {
      const emojiGrid = puzzleLines.map((line, row) =>
        line.split('').map((char, col) => {
          if (!/[A-Z]/.test(char)) return char;
          const cellContent = blanks[row][col];
          return (typeof cellContent === 'string' && cellContent.includes('hint-letter')) ? '🟦' : '🟩';
        }).join('')
      ).join('\n'); // emojiGrid will contain literal '\n' for newlines

      const messages = ["Flawless solve! 🎯", "Golden guess! 🌟", "Well played! ✨", "Puzzle conquered! 💪"];
      const performanceMsg = messages[Math.min(hintCount, 3)];
      const siteUrl = "https://dailycryptoquip.com";

      const shareTextBase =
        `Daily Cryptoquip\n` +
        `${hintCount} Hint${hintCount !== 1 ? 's' : ''} used. ${performanceMsg}\n\n` +
        `🔤 "${puzzleLines.length > 0 ? puzzleLines[0].substring(0, 6) : 'Puzzle'}..." (${puzzleLines.join(' ').length}-letter puzzle)\n` +
        `📊 ${emojiGrid}\n\n` +
        `Can you crack the code?`;

      const isMobile = (() => {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile !== 'undefined') {
          return navigator.userAgentData.mobile;
        }
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      })();

      const copyToClipboardAndShowMessage = async () => {
        // For clipboard, replace literal '\n' with actual newline characters.
        // Also append the site URL.
        const textForClipboard = shareTextBase.replace(/\\n/g, '\n') + '\n' + siteUrl;
        try {
          await navigator.clipboard.writeText(textForClipboard);
          const feedback = document.getElementById('copy-feedback');
          feedback.textContent = "RESULTS COPIED TO CLIPBOARD";
          setTimeout(() => feedback.textContent = "", 3000);
        } catch (err) {
          console.error('Failed to copy results: ', err);
          prompt("Copy your results:", textForClipboard); // Fallback prompt
        }
      };

      if (isMobile && navigator.share) {
        try {
          await navigator.share({
            title: 'Daily Cryptoquip Results',
            // For navigator.share, replace literal '\n' with actual newline characters.
            // The URL is a separate property.
            text: shareTextBase.replace(/\\n/g, '\n'),
            url: siteUrl,
          });
        } catch (err) {
          console.error('Error using Web Share API:', err);
          if (err.name !== 'AbortError') {
            // Fallback for non-cancellation errors (optional)
            // await copyToClipboardAndShowMessage();
          }
        }
      } else {
        // Desktop, or mobile without navigator.share
        await copyToClipboardAndShowMessage();
      }
    }

    // Event listeners
    document.addEventListener('DOMContentLoaded', () => {
      fetchAndInitializePuzzle(); // Fetch puzzle when DOM is ready

      // Other event listeners that are safe to set up once
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement && (document.activeElement.id === 'from' || document.activeElement.id === 'to')) {
            substitute();
        }
        if (e.key === 'ArrowRight' && document.activeElement && document.activeElement.id === 'from') {
            document.getElementById('to').focus();
        }
        if (e.key === 'ArrowLeft' && document.activeElement && document.activeElement.id === 'to') {
            document.getElementById('from').focus();
        }
        if (e.key === 'Escape') {
          if (document.getElementById('congrats-popup').style.display === 'flex') closePopup();
          else if (document.getElementById('how-to-play-popup').style.display === 'flex') closeHTP();
        }
      });

      const fromInput = document.getElementById('from');
      const toInput = document.getElementById('to');
      if (fromInput) {
        fromInput.addEventListener('input', function(e) {
          this.value = this.value.replace(/[^A-Za-z]/g, '').toUpperCase();
        });
      }
      if (toInput) {
        toInput.addEventListener('input', function(e) {
          this.value = this.value.replace(/[^A-Za-z]/g, '').toUpperCase();
        });
      }

      const helpButton = document.getElementById('help-btn');
      if (helpButton) helpButton.addEventListener('click', toggleHowToPlay);

      document.addEventListener('keydown', checkAdminCode);
      // Removed document.addEventListener('DOMContentLoaded', updateAlphabetGrid); as it's called after fetch
      document.addEventListener('touchstart', function() {}, {passive: true}); // For :active styles on touch
    });
