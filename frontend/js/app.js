const API_URL = "https://odin-wheres-waldo-nn9t.onrender.com/api";

const elements = {
  timer: document.getElementById("timer"),
  characterList: document.getElementById("character-list"),
  gameImage: document.getElementById("game-image"),
  imageContainer: document.getElementById("image-container"),
  markers: document.getElementById("markers"),
  feedback: document.getElementById("feedback"),
  gameStatus: document.getElementById("game-status"),
  restartButton: document.getElementById("restart-button"),
  scoreDialog: document.getElementById("score-dialog"),
  scoreForm: document.getElementById("score-form"),
  playerName: document.getElementById("player-name"),
  scoreError: document.getElementById("score-error"),
  saveScoreButton: document.getElementById("save-score-button"),
  leaderboard: document.getElementById("leaderboard"),
};

let gameId = null;
let sessionId = null;
let characters = [];
let selectedCharacter = null;
let foundCharacters = new Set();
let startedAt = null;
let timerInterval = null;
let gameCompleted = false;
let scoreSaved = false;
let guessInProgress = false;

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

function showFeedback(message, type = "") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${type}`;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimer() {
  if (!startedAt || gameCompleted) return;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  elements.timer.textContent = formatTime(Math.max(0, elapsed));
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimer();
  timerInterval = setInterval(updateTimer, 250);
}

function renderCharacters() {
  elements.characterList.replaceChildren();

  characters.forEach((character) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "character-item";
    button.textContent = character.name;
    button.dataset.id = character.id;

    if (foundCharacters.has(character.id)) {
      button.classList.add("found");
      button.disabled = true;
    } else {
      button.addEventListener("click", () => {
        selectedCharacter = character.id;
        updateCharacterSelection();
      });
    }

    elements.characterList.appendChild(button);
  });
}

function updateCharacterSelection() {
  document.querySelectorAll(".character-item").forEach((button) => {
    button.classList.toggle(
      "selected",
      Number(button.dataset.id) === selectedCharacter,
    );
  });

  const character = characters.find((item) => item.id === selectedCharacter);

  if (character) {
    showFeedback(`Now find ${character.name}.`);
  }
}

function addFoundMarker(character) {
  const marker = document.createElement("div");

  marker.className = "found-marker";
  marker.style.left = `${character.x * 100}%`;
  marker.style.top = `${character.y * 100}%`;
  marker.setAttribute("aria-label", `${character.name} found`);

  elements.markers.appendChild(marker);
}

async function loadLeaderboard() {
  try {
    const data = await apiRequest(`/games/${gameId}/leaderboard`);

    if (data.leaderboard.length === 0) {
      elements.leaderboard.textContent = "No scores yet. Be the first!";
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    ["Rank", "Player", "Time"].forEach((heading) => {
      const th = document.createElement("th");
      th.textContent = heading;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    data.leaderboard.forEach((entry, index) => {
      const row = document.createElement("tr");

      const rank = document.createElement("td");
      const name = document.createElement("td");
      const time = document.createElement("td");

      rank.textContent = index + 1;
      name.textContent = entry.playerName;
      time.textContent = formatTime(entry.scoreMs);

      row.append(rank, name, time);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    elements.leaderboard.replaceChildren(table);
  } catch (error) {
    elements.leaderboard.textContent = "Could not load leaderboard.";
    console.error(error);
  }
}

async function startGame() {
  try {
    elements.gameStatus.textContent = "Starting game...";
    elements.restartButton.disabled = true;

    foundCharacters.clear();
    selectedCharacter = null;
    gameCompleted = false;
    scoreSaved = false;
    startedAt = null;
    guessInProgress = false;

    elements.markers.replaceChildren();
    elements.timer.textContent = "00:00";
    elements.scoreForm.reset();
    elements.scoreError.textContent = "";

    if (elements.scoreDialog.open) {
      elements.scoreDialog.close();
    }

    const data = await apiRequest(`/games/${gameId}/start`, {
      method: "POST",
    });

    sessionId = data.sessionId;
    startedAt = data.startedAt;
    characters = data.game.characters;

    renderCharacters();
    startTimer();

    elements.gameStatus.textContent = "Find all three characters!";
    elements.restartButton.disabled = false;

    showFeedback("Select a character, then find them in the picture.");
  } catch (error) {
    elements.gameStatus.textContent = "Could not start game.";
    showFeedback(error.message, "error");
  }
}

async function handleImageClick(event) {
  if (!sessionId || gameCompleted || !selectedCharacter || guessInProgress) {
    if (!selectedCharacter && !gameCompleted) {
      showFeedback("Select a character first.", "error");
    }
    return;
  }

  const rect = elements.gameImage.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;

  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  guessInProgress = true;
  elements.gameImage.style.cursor = "wait";

  try {
    const data = await apiRequest(`/games/sessions/${sessionId}/guess`, {
      method: "POST",
      body: JSON.stringify({
        characterId: selectedCharacter,
        x,
        y,
      }),
    });

    if (!data.correct) {
      showFeedback("Not quite! Try again.", "error");
      return;
    }

    if (data.alreadyFound) {
      showFeedback("You've already found that character.");
      return;
    }

    foundCharacters.add(data.character.id);

    addFoundMarker(data.character);
    renderCharacters();

    selectedCharacter = null;

    showFeedback(`${data.character.name} found!`, "success");

    elements.gameStatus.textContent = `${data.remaining} character(s) remaining`;

    if (data.completed) {
      finishGame(data.scoreMs);
    }
  } catch (error) {
    showFeedback(error.message, "error");
  } finally {
    guessInProgress = false;
    elements.gameImage.style.cursor = "crosshair";
  }
}

function finishGame(scoreMs) {
  gameCompleted = true;
  clearInterval(timerInterval);

  elements.timer.textContent = formatTime(scoreMs);
  elements.gameStatus.textContent = "All characters found!";
  showFeedback("Congratulations! You found everyone!", "success");

  elements.scoreDialog.showModal();
  elements.playerName.focus();
}

async function saveScore(event) {
  event.preventDefault();

  if (scoreSaved || !sessionId || !gameCompleted) return;

  const playerName = elements.playerName.value.trim();

  if (!playerName) {
    elements.scoreError.textContent = "Enter your name.";
    return;
  }

  elements.saveScoreButton.disabled = true;
  elements.scoreError.textContent = "";

  try {
    const data = await apiRequest(`/games/sessions/${sessionId}/score`, {
      method: "POST",
      body: JSON.stringify({ playerName }),
    });

    scoreSaved = true;
    elements.scoreDialog.close();

    showFeedback(`Score saved! Well done, ${data.playerName}!`, "success");

    await loadLeaderboard();
  } catch (error) {
    elements.scoreError.textContent = error.message;
  } finally {
    elements.saveScoreButton.disabled = scoreSaved;
  }
}

async function initializeGame() {
  try {
    elements.gameStatus.textContent = "Loading game...";

    // Wait until the scene has loaded before starting the timer.
    if (!elements.gameImage.complete || !elements.gameImage.naturalWidth) {
      await new Promise((resolve, reject) => {
        elements.gameImage.addEventListener("load", resolve, { once: true });
        elements.gameImage.addEventListener(
          "error",
          () => reject(new Error("Could not load the game image.")),
          { once: true },
        );
      });
    }

    const data = await apiRequest("/games");

    if (!data.games.length) {
      throw new Error("No games are currently available.");
    }

    const game = data.games[0];
    gameId = game.id;

    elements.gameImage.alt = `Find the hidden characters in ${game.name}.`;

    await startGame();
    await loadLeaderboard();
  } catch (error) {
    elements.gameStatus.textContent = "Game unavailable";
    showFeedback(error.message, "error");
    console.error(error);
  }
}

elements.gameImage.addEventListener("click", handleImageClick);
elements.restartButton.addEventListener("click", startGame);
elements.scoreForm.addEventListener("submit", saveScore);

initializeGame();
