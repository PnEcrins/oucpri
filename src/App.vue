<script setup>
import { ref, onMounted, computed } from "vue";
import GameStep from "./components/GameStep.vue";
import AdminPanel from "./components/AdminPanel.vue";
import LoginPage from "./components/LoginPage.vue";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Authentication
const user = ref(null);
const token = ref(null);

// UI State
const selectedGameIndex = ref(0);
const allGames = ref([]);
const publicGames = ref([]);
const photos = ref([]);
const currentStep = ref(0);
const guesses = ref([]);
const score = ref(0);
const showResult = ref(false);
const showAdmin = ref(false);
const showHome = ref(true);
const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');
const isLoading = ref(false);
const error = ref('');
const isDev = ref(true); // Always allow admin access in local dev

// Computed
const currentGameId = computed(() => {
  return allGames.value[selectedGameIndex.value]?.id || null;
});

// Initialize dark mode
onMounted(() => {
  applyDarkMode(isDarkMode.value);
  checkAuthentication();
  
  // Check for shared quiz link
  const params = new URLSearchParams(window.location.search);
  const sharedQuizId = params.get('quiz');
  
  if (sharedQuizId) {
    console.log('Shared quiz ID:', sharedQuizId);
    // Will be handled after quizzes load
    sessionStorage.setItem('sharedQuizId', sharedQuizId);
  }
});

// Check if user is already logged in
function checkAuthentication() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  console.log('Checking authentication...');
  console.log('Stored token:', storedToken ? 'exists' : 'none');
  console.log('Stored user:', storedUser ? 'exists' : 'none');
  
  if (storedToken && storedUser) {
    try {
      token.value = storedToken;
      user.value = JSON.parse(storedUser);
      console.log('User restored:', user.value);
      loadQuizzes();
    } catch (e) {
      console.error('Error restoring authentication:', e);
      logout();
    }
  } else {
    console.log('No stored token or user found');
  }
}

// Load quizzes for authenticated user
async function loadQuizzes() {
  if (!token.value) {
    console.log('No token available, skipping loadQuizzes');
    return;
  }
  
  console.log('Loading quizzes with token:', token.value.substring(0, 20) + '...');
  isLoading.value = true;
  error.value = '';
  
  try {
    // Load user's own quizzes
    const response = await fetch(`${API_URL}/api/quizzes`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    
    console.log('Quizzes response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid or expired');
        logout();
        return;
      }
      throw new Error('Failed to load quizzes');
    }
    
    const data = await response.json();
    allGames.value = data.quizzes || [];
    console.log('Loaded user quizzes:', allGames.value.length);
    
    // Load all public quizzes
    try {
      const publicResponse = await fetch(`${API_URL}/api/quizzes/all/public`, {
        headers: { 'Authorization': `Bearer ${token.value}` }
      });
      
      if (publicResponse.ok) {
        const publicData = await publicResponse.json();
        publicGames.value = publicData.quizzes || [];
        console.log('Loaded public quizzes:', publicGames.value.length);
      }
    } catch (err) {
      console.error('Error loading public quizzes:', err);
    }
    
    // Check if a quiz was shared
    const sharedQuizId = sessionStorage.getItem('sharedQuizId');
    if (sharedQuizId) {
      // First check own quizzes
      let quizIndex = allGames.value.findIndex(q => q.id === parseInt(sharedQuizId));
      if (quizIndex !== -1) {
        console.log('Loading shared quiz:', sharedQuizId);
        sessionStorage.removeItem('sharedQuizId');
        await selectGame(quizIndex);
      } else {
        // Then check public quizzes
        quizIndex = publicGames.value.findIndex(q => q.id === parseInt(sharedQuizId));
        if (quizIndex !== -1) {
          console.log('Loading shared public quiz:', sharedQuizId);
          sessionStorage.removeItem('sharedQuizId');
          await selectGamePublic(quizIndex);
        } else {
          console.log('Shared quiz not found, showing home');
          showHome.value = true;
        }
      }
    } else {
      // Show home page with quizzes
      showHome.value = true;
      showAdmin.value = false;
    }
  } catch (err) {
    console.error('Error loading quizzes:', err);
    error.value = 'Failed to load quizzes';
  } finally {
    isLoading.value = false;
  }
}

// Load photos for a specific public quiz
async function selectGamePublic(idx) {
  const quiz = publicGames.value[idx];
  if (!quiz || !token.value) return;
  
  selectedGameIndex.value = idx;
  isLoading.value = true;
  
  try {
    const response = await fetch(`${API_URL}/api/quizzes/${quiz.id}/photos`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quiz photos');
    }
    
    const data = await response.json();
    photos.value = data.photos || [];
    
    // Reset game state
    currentStep.value = 0;
    guesses.value = [];
    score.value = 0;
    showResult.value = false;
    showHome.value = false;
  } catch (err) {
    console.error('Error loading quiz:', err);
    error.value = 'Failed to load quiz';
  } finally {
    isLoading.value = false;
  }
}

// Load photos for a specific quiz
async function selectGame(idx) {
  const quiz = allGames.value[idx];
  if (!quiz || !token.value) return;
  
  selectedGameIndex.value = idx;
  isLoading.value = true;
  
  try {
    const response = await fetch(`${API_URL}/api/quizzes/${quiz.id}/photos`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quiz photos');
    }
    
    const data = await response.json();
    photos.value = data.photos || [];
    
    // Reset game state
    currentStep.value = 0;
    guesses.value = [];
    score.value = 0;
    showResult.value = false;
    showHome.value = false;
  } catch (err) {
    console.error('Error loading quiz:', err);
    error.value = 'Failed to load quiz';
  } finally {
    isLoading.value = false;
  }
}

// Handle login
async function handleLogin(userInfo) {
  user.value = userInfo;
  token.value = userInfo.token;
  localStorage.setItem('token', userInfo.token);
  localStorage.setItem('user', JSON.stringify({ username: userInfo.username, id: userInfo.id }));
  await loadQuizzes();
}

// Logout
function logout() {
  user.value = null;
  token.value = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  allGames.value = [];
  photos.value = [];
  showHome.value = true;
}

// Go back to home
function goHome() {
  showHome.value = true;
  showAdmin.value = false;
}

// Copy share link to clipboard
function shareQuiz(quizId) {
  const shareUrl = `${window.location.origin}?quiz=${quizId}`;
  navigator.clipboard.writeText(shareUrl);
  alert('Quiz link copied to clipboard!');
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Dark mode toggle
function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('darkMode', isDarkMode.value.toString());
  applyDarkMode(isDarkMode.value);
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.style.colorScheme = 'dark';
    document.body.classList.add('dark-mode');
  } else {
    document.documentElement.style.colorScheme = 'light';
    document.body.classList.remove('dark-mode');
  }
}

// Game logic
function handleGuess(latlng) {
  guesses.value[currentStep.value] = latlng;
}

function validateGuess() {
  showResult.value = true;
}

async function onGameSaved() {
  showAdmin.value = false;
  await loadQuizzes();
}

function nextStep() {
  const guess = guesses.value[currentStep.value];
  const answer = photos.value[currentStep.value].location;
  if (guess) {
    const dist = haversine(guess.lat, guess.lng, answer[0], answer[1]);
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
  const R = 6371;
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
  <div v-if="!user && !isLoading">
    <LoginPage @login="handleLogin" />
  </div>
  <div v-else-if="isLoading" class="loading">
    <p>Loading...</p>
  </div>
  <div v-else-if="error" class="error-banner">
    {{ error }}
  </div>
  <main v-else>
    <div class="header">
      <h1>OUCPRI</h1>
      <div class="header-right">
        <button @click="toggleDarkMode" class="dark-mode-toggle">
          {{ isDarkMode ? '☀️' : '🌙' }}
        </button>
        <div class="user-info">
          <span>{{ user?.username }}</span>
          <button @click="logout" class="logout-btn">Logout</button>
        </div>
        <button v-if="isDev" @click="showAdmin = !showAdmin" class="admin-toggle">
          {{ showAdmin ? "← Back" : "⚙️ Admin" }}
        </button>
        <button v-if="!showHome && !showAdmin" @click="goHome" class="home-btn">
          🏠 Home
        </button>
      </div>
    </div>

    <!-- HOME PAGE - List of quizzes -->
    <div v-if="showHome && !showAdmin" class="home-page">
      <h2>My Quizzes</h2>
      <div v-if="isLoading" class="loading">Loading quizzes...</div>
      <div v-else-if="allGames.length === 0" class="no-quizzes">
        <p>No quizzes yet. Create your first one!</p>
        <button v-if="isDev" @click="showAdmin = true" class="create-btn">
          ➕ Create Quiz
        </button>
      </div>
      <div v-else class="quizzes-grid">
        <div v-for="quiz in allGames" :key="quiz.id" class="quiz-card">
          <h3>{{ quiz.name }}</h3>
          <p class="quiz-date">Created: {{ formatDate(quiz.created_at) }}</p>
          <div class="quiz-actions">
            <button @click="selectGame(allGames.findIndex(q => q.id === quiz.id))" class="play-btn">
              ▶️ Play
            </button>
            <button @click="shareQuiz(quiz.id)" class="share-btn" title="Copy share link">
              🔗 Share
            </button>
          </div>
        </div>
      </div>
      <button v-if="isDev" @click="showAdmin = true" class="create-btn">
        ➕ Create New Quiz
      </button>
    </div>

    <!-- PUBLIC QUIZZES SECTION -->
    <div v-if="showHome && !showAdmin" class="public-quizzes-section">
      <h2>All Quizzes</h2>
      <div v-if="isLoading" class="loading">Loading quizzes...</div>
      <div v-else-if="publicGames.length === 0" class="no-quizzes">
        <p>No public quizzes available yet.</p>
      </div>
      <div v-else class="quizzes-grid">
        <div v-for="quiz in publicGames" :key="quiz.id" class="quiz-card public-quiz-card">
          <h3>{{ quiz.name }}</h3>
          <p class="quiz-author">by @{{ quiz.username }}</p>
          <p class="quiz-date">{{ formatDate(quiz.created_at) }}</p>
          <div class="quiz-actions">
            <button @click="selectGamePublic(publicGames.findIndex(q => q.id === quiz.id))" class="play-btn">
              ▶️ Play
            </button>
            <button @click="shareQuiz(quiz.id)" class="share-btn" title="Copy share link">
              🔗 Share
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADMIN PANEL -->
    <AdminPanel
      v-if="showAdmin"
      :token="token"
      :apiUrl="API_URL"
      @close="showAdmin = false"
      @gameSaved="onGameSaved"
    />

    <!-- GAME VIEW -->
    <div
      v-else-if="
        !showHome &&
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
  </main>
</template>

<style scoped>
main {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
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
  color: var(--color-text);
  font-size: 2rem;
  text-align: center;
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.dark-mode-toggle {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background 0.3s;
}

.dark-mode-toggle:hover {
  background: var(--color-bg-hover);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  font-size: 0.9rem;
}

.logout-btn {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  background: var(--color-error);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

.logout-btn:hover {
  background: var(--color-error-dark);
}

.error-banner {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  border-left: 4px solid var(--color-error);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.game-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.game-selector label {
  font-weight: 600;
  color: var(--color-text);
}

.game-selector select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
}

.admin-button {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.admin-toggle {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.admin-toggle:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 8px rgba(66, 184, 131, 0.3);
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
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.controls p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.result-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg);
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
  color: var(--color-text);
  text-align: center;
}

.score-gained {
  font-size: 2rem;
  font-weight: bold;
  color: var(--color-primary);
  text-align: center;
  margin: 1rem 0;
}

.result-details {
  background: var(--color-bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  margin: 1.5rem 0;
  font-size: 0.95rem;
}

.result-details p {
  margin: 0.5rem 0;
  color: var(--color-text);
}

.validate-btn,
.next-btn {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.validate-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.validate-btn:disabled {
  background: var(--color-border);
  cursor: not-allowed;
  opacity: 0.6;
}

.next-btn {
  margin-top: 1.5rem;
}

.score-summary {
  text-align: center;
  padding: 2rem 1rem;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  margin-top: 2rem;
}

.score-summary h2 {
  color: var(--color-text);
  margin-bottom: 1.5rem;
}

.score-card {
  background: var(--color-bg);
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 2px solid var(--color-primary);
}

.final-score {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--color-text);
  margin: 0.5rem 0;
}

.score-percentage {
  font-size: 3rem;
  font-weight: bold;
  color: var(--color-primary);
  margin: 0.5rem 0;
}

.score-message {
  font-size: 1.3rem;
  margin: 1rem 0 0 0;
  color: var(--color-text-secondary);
}

.results-list {
  text-align: left;
  max-width: 600px;
  margin: 0 auto;
  background: var(--color-bg);
  padding: 1.5rem;
  border-radius: 8px;
}

.results-list h3 {
  text-align: center;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.result-item {
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
}

.photo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.photo-score {
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.85rem;
}

.photo-details {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin: 0.5rem 0;
}

.solution {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.label {
  font-weight: 600;
  color: var(--color-text);
}

.replay-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.replay-btn:hover {
  background: var(--color-primary-hover);
}

.no-games {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  margin-top: 2rem;
}

.no-games h2 {
  color: var(--color-text);
  margin-bottom: 1rem;
}

.no-games p {
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.no-games p {
  color: var(--color-text-secondary);
  font-size: 1rem;
}

/* HOME PAGE STYLES */
.home-page {
  padding: 2rem 1rem;
}

.home-page h2 {
  text-align: center;
  color: var(--color-text);
  margin-bottom: 2rem;
  font-size: 2rem;
}

.no-quizzes {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  margin-bottom: 2rem;
}

.no-quizzes p {
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}

.quizzes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.quiz-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quiz-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary);
}

.quiz-card h3 {
  color: var(--color-text);
  margin: 0;
  font-size: 1.2rem;
}

.quiz-date {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  margin: 0;
}

.quiz-author {
  color: #66c0ff;
  font-size: 0.9rem;
  margin: 0;
  font-weight: 500;
}

.public-quizzes-section {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 2px solid var(--color-border);
}

.public-quiz-card {
  opacity: 0.95;
}

.public-quiz-card:hover {
  opacity: 1;
}

.quiz-actions {
  display: flex;
  gap: 0.75rem;
}

.play-btn,
.share-btn {
  flex: 1;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.play-btn {
  background: var(--color-primary);
  color: white;
}

.play-btn:hover {
  background: var(--color-primary-hover);
}

.share-btn {
  background: var(--color-border);
  color: var(--color-text);
}

.share-btn:hover {
  background: var(--color-primary);
  color: white;
}

.create-btn {
  display: block;
  margin: 1rem auto;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.create-btn:hover {
  background: var(--color-primary-hover);
}

.home-btn {
  padding: 0.4rem 0.8rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.home-btn:hover {
  background: var(--color-primary-hover);
}

@media (max-width: 600px) {
  h1 {
    font-size: 1.5rem;
  }

  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .user-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .game-selector {
    flex-direction: column;
    gap: 0.5rem;
  }

  .score-card {
    padding: 1.5rem;
  }

  .final-score {
    font-size: 2rem;
  }

  .score-percentage {
    font-size: 2.5rem;
  }

  .game-layout {
    min-height: 50vh;
  }

  .result-panel {
    max-height: 60vh;
  }

  .quizzes-grid {
    grid-template-columns: 1fr;
  }

  .home-page h2 {
    font-size: 1.5rem;
  }
}
</style>
