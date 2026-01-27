<script setup>
import { ref, onMounted } from "vue";
import GameStep from "./components/GameStep.vue";
import AdminPanel from "./components/AdminPanel.vue";

// Charger les données JSON (import statique pour build statique)

import photosAllGames from "../photos.json";

const allGames = Array.isArray(photosAllGames) ? photosAllGames : [];
const selectedGameIndex = ref(0);
const photos = ref(
  allGames.length > 0 && Array.isArray(allGames[0]) ? allGames[0] : [],
);
const currentStep = ref(0);
const guesses = ref([]);
const score = ref(0);
const showResult = ref(false);
const showAdmin = ref(false);
const isDev = import.meta.env.DEV;

function selectGame(idx) {
  console.log('Selecting game:', idx);
  console.log('All games:', allGames);
  console.log('Game data:', allGames[idx]);
  selectedGameIndex.value = idx;
  photos.value = Array.isArray(allGames[idx]) ? allGames[idx] : [];
  console.log('Photos updated:', photos.value);
  currentStep.value = 0;
  guesses.value = [];
  score.value = 0;
  showResult.value = false;
}

function handleGuess(latlng) {
  guesses.value[currentStep.value] = latlng;
}

function validateGuess() {
  // Affiche le résultat au lieu de passer à l'étape suivante
  showResult.value = true;
}

function onGameSaved() {
  showAdmin.value = false;
  // Reload all games from static import (user must refresh page to see new games in prod)
  // In dev, hot reload may work
  // For now, just reset to first game
  selectedGameIndex.value = 0;
  photos.value = allGames.length > 0 ? allGames[0] : [];
  currentStep.value = 0;
  guesses.value = [];
  score.value = 0;
  showResult.value = false;
}

function nextStep() {
  // Calcul du score pour l'étape courante
  const guess = guesses.value[currentStep.value];
  const answer = photos.value[currentStep.value].location;
  if (guess) {
    const dist = haversine(guess.lat, guess.lng, answer[0], answer[1]);
    // Score max 200, 0 si > 2000km, linéaire sinon
    const pts = Math.max(
      0,
      Math.round(200 * (1 - Math.min(dist, 2000) / 2000)),
    );
    score.value += pts;
  }
  showResult.value = false;
  currentStep.value++;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getPhotoScore(i) {
  const guess = guesses.value[i];
  if (!guess) return 0;
  const answer = photos.value[i].location;
  const dist = haversine(guess.lat, guess.lng, answer[0], answer[1]);
  return Math.max(0, Math.round(200 * (1 - Math.min(dist, 2000) / 2000)));
}

function getPhotoDistance(i) {
  const guess = guesses.value[i];
  if (!guess) return "N/A";
  const answer = photos.value[i].location;
  const dist = haversine(guess.lat, guess.lng, answer[0], answer[1]);
  return dist.toFixed(0);
}

function getScoreMessage() {
  const percentage = (score.value / (photos.value.length * 200)) * 100;
  if (percentage >= 90) return "🏆 Excellent ! Vous êtes un expert !";
  if (percentage >= 70) return "👏 Très bien ! Impressionnant !";
  if (percentage >= 50) return "😊 Pas mal ! Continuez à vous entraîner";
  return "📚 À refaire ! Vous allez progresser";
}
</script>

<template>
  <main>
    <div class="header">
      <h1>WhereTaken - Location Game</h1>
      <button v-if="isDev" @click="showAdmin = !showAdmin" class="admin-toggle">
        {{ showAdmin ? "← Back to game" : "⚙️ Admin" }}
      </button>
    </div>
    <div v-if="!showAdmin && allGames.length > 1" class="game-selector">
      <label for="game-select">Choose a game:</label>
      <select
        id="game-select"
        :value="selectedGameIndex"
        @change="(e) => selectGame(Number(e.target.value))"
      >
        <option v-for="(g, idx) in allGames" :key="idx" :value="idx">
          Game {{ idx + 1 }}
        </option>
      </select>
    </div>
    <AdminPanel
      v-if="showAdmin"
      @close="showAdmin = false"
      @gameSaved="onGameSaved"
    />
    <div
      v-else-if="
        photos &&
        Array.isArray(photos) &&
        photos.length > 0 &&
        currentStep < photos.length
      "
    >
      <div class="game-layout">
        <GameStep
          :photo="photos[currentStep]"
          :onGuess="handleGuess"
          :showLine="showResult"
          :userGuess="guesses[currentStep]"
          :correctAnswer="photos[currentStep].location"
        />
        <div v-if="!showResult" class="controls">
          <button
            @click="validateGuess"
            :disabled="!guesses[currentStep]"
            class="validate-btn"
          >
            Valider et voir le résultat
          </button>
          <p v-if="guesses[currentStep]">
            Vous avez choisi : {{ guesses[currentStep].lat.toFixed(4) }},
            {{ guesses[currentStep].lng.toFixed(4) }}
          </p>
          <p>Current score: {{ score }}</p>
          <p>Photo {{ currentStep + 1 }} / {{ photos.length }}</p>
        </div>
      </div>
      <div v-if="showResult" class="result-panel">
        <div class="result-content">
          <h3>Photo {{ currentStep + 1 }} - Result</h3>
          <p class="score-gained">+{{ getPhotoScore(currentStep) }} points</p>
          <div v-if="guesses[currentStep]" class="result-details">
            <p>
              <span class="label">Distance:</span>
              {{ getPhotoDistance(currentStep) }} km
            </p>
            <p>
              <span class="label">Your guess:</span>
              {{ guesses[currentStep].lat.toFixed(4) }},
              {{ guesses[currentStep].lng.toFixed(4) }}
            </p>
            <p>
              <span class="label">Solution:</span>
              {{ photos[currentStep].location[0].toFixed(4) }},
              {{ photos[currentStep].location[1].toFixed(4) }}
            </p>
          </div>
          <div v-else class="result-details">
            <p>You did not answer this question.</p>
          </div>
          <button @click="nextStep" class="next-btn">Next</button>
        </div>
      </div>
    </div>
    <div
      v-else-if="
        photos &&
        Array.isArray(photos) &&
        photos.length > 0
      "
      class="score-summary"
    >
      <h2>🎉 Game finished!</h2>
      <div class="score-card">
        <p class="final-score">
          {{ score }} /
          {{ photos && photos.length ? photos.length * 200 : 0 }} points
        </p>
        <p class="score-percentage">
          {{
            photos && photos.length
              ? ((score / (photos.length * 200)) * 100).toFixed(0)
              : 0
          }}%
        </p>
        <p class="score-message">{{ getScoreMessage() }}</p>
      </div>
      <div class="results-list">
        <h3>Details per photo</h3>
        <div v-for="(photo, i) in photos" :key="i" class="result-item">
          <div class="photo-header">
            <strong>Photo {{ i + 1 }}</strong>
            <span class="photo-score">{{ getPhotoScore(i) }} pts</span>
          </div>
          <div v-if="guesses[i]" class="photo-details">
            <p>
              <span class="label">Your guess:</span>
              {{ guesses[i].lat.toFixed(4) }}, {{ guesses[i].lng.toFixed(4) }}
            </p>
            <p>
              <span class="label">Distance:</span> {{ getPhotoDistance(i) }} km
            </p>
          </div>
          <div v-else class="photo-details">
            <p><span class="label">Your guess:</span> <em>No answer</em></p>
          </div>
          <p class="solution">
            <span class="label">Solution:</span>
            {{ photo.location[0].toFixed(4) }},
            {{ photo.location[1].toFixed(4) }}
          </p>
        </div>
      </div>
      <button
        class="replay-btn"
        @click="
          currentStep = 0;
          guesses = [];
          score = 0;
        "
      >
        Play again
      </button>
    </div>
    <div v-else class="no-games">
      <h2>No games available</h2>
      <p>Please add games using the admin panel (⚙️ Admin button above).</p>
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h1 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.admin-toggle {
  padding: 0.5rem 1rem;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.admin-toggle:hover {
  background: #359268;
  box-shadow: 0 4px 8px rgba(66, 184, 131, 0.3);
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  background: #42b883;
  color: #fff;
  cursor: pointer;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.game-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 50vh;
  padding-bottom: 40vh;
}
.controls {
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}
.controls p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
  color: #555;
}
.result-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideUpPanel 0.3s ease-out;
  max-height: 35vh;
  overflow-y: auto;
}
@keyframes slideUpPanel {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.result-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.result-content h3 {
  margin: 0 0 1rem 0;
  color: #333;
  text-align: center;
}
.score-gained {
  font-size: 2rem;
  font-weight: bold;
  color: #42b883;
  text-align: center;
  margin: 1rem 0;
}
.result-details {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  margin: 1.5rem 0;
  font-size: 0.95rem;
}
.result-details p {
  margin: 0.5rem 0;
  color: #555;
}
.validate-btn,
.next-btn {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  background: #42b883;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
.validate-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.next-btn {
  margin-top: 1.5rem;
}
@media (max-width: 600px) {
  .score-card {
    padding: 1.5rem;
  }
  .final-score {
    font-size: 2rem;
  }
  .result-card {
    padding: 1.5rem;
  }
  .game-layout {
    min-height: 50vh;
  }
  .result-panel {
    max-height: 60vh;
  }
}
.no-games {
  text-align: center;
  padding: 3rem 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  margin-top: 2rem;
}
.no-games h2 {
  color: #333;
  margin-bottom: 1rem;
}
.no-games p {
  color: #666;
  font-size: 1rem;
}
</style>
