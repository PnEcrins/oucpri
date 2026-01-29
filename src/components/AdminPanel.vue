<template>
  <div class="admin-container">
    <h2>Manage Quizzes</h2>

    <!-- Create New Quiz Tab -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
        class="tab-button"
      >
        {{ tab === "create" ? "➕ Create New" : "📚 My Quizzes" }}
      </button>
    </div>

    <!-- Create New Quiz Section -->
    <div v-if="activeTab === 'create'" class="admin-form">
      <h3>{{ editingQuizId ? "✏️ Edit Quiz" : "➕ Create a new quiz" }}</h3>

      <div class="form-group">
        <label for="quiz-name">Quiz Name *</label>
        <input
          id="quiz-name"
          v-model="formData.quizName"
          type="text"
          placeholder="e.g., France Cities, World Landmarks..."
          class="quiz-name-input"
          :disabled="isLoading"
        />
      </div>

      <div class="form-group">
        <label for="creator-name">Your Name *</label>
        <input
          id="creator-name"
          v-model="formData.creatorName"
          type="text"
          placeholder="e.g., John, Marie..."
          class="quiz-name-input"
          :disabled="isLoading"
        />
      </div>

      <h4>Upload 5 images with coordinates</h4>

      <div
        v-for="(photo, index) in formData.photos"
        :key="index"
        class="photo-form-group"
      >
        <div class="photo-header">
          <h4>Image {{ index + 1 }}</h4>
          <span v-if="photo.file" class="file-name">{{ photo.file.name }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Choose image</label>
            <input
              type="file"
              accept="image/*"
              @change="(e) => onFileSelected(index, e)"
              class="file-input"
              :disabled="isLoading"
            />
            <div v-if="photo.preview" class="image-preview">
              <img :src="photo.preview" :alt="`Image ${index + 1}`" />
            </div>
          </div>
        </div>

        <AdminMap
          v-if="photo.file || (photo.lat !== null && photo.lng !== null)"
          :currentLat="photo.lat"
          :currentLng="photo.lng"
          @update:coordinates="(coords) => onCoordinatesSelected(index, coords)"
        />

        <div
          class="coordinates-display"
          v-if="photo.lat !== null && photo.lng !== null"
        >
          📍 Coordinates: {{ photo.lat.toFixed(4) }}, {{ photo.lng.toFixed(4) }}
        </div>
      </div>

      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>

      <div class="form-actions">
        <button @click="saveGame" class="save-btn" :disabled="isLoading">
          {{
            isLoading
              ? "Saving..."
              : editingQuizId
                ? "💾 Update Quiz"
                : "💾 Create Quiz"
          }}
        </button>
        <button @click="resetForm" class="reset-btn" :disabled="isLoading">
          Reset
        </button>
        <button
          v-if="editingQuizId"
          @click="
            () => {
              editingQuizId = null;
              resetForm();
            }
          "
          class="cancel-btn"
          :disabled="isLoading"
        >
          Cancel Edit
        </button>
        <button
          v-else
          @click="emit('close')"
          class="cancel-btn"
          :disabled="isLoading"
        >
          Close
        </button>
      </div>
    </div>

    <!-- My Quizzes Section -->
    <div v-else class="quizzes-list">
      <div v-if="isLoadingQuizzes" class="loading">Loading quizzes...</div>
      <div v-else-if="myQuizzes.length === 0" class="no-quizzes">
        <p>No quizzes yet. Create one using the "Create New" tab!</p>
      </div>
      <div v-else class="quizzes-grid">
        <div v-for="quiz in myQuizzes" :key="quiz.id" class="quiz-card">
          <div class="quiz-info">
            <h4>{{ quiz.name }}</h4>
            <p class="quiz-date">Created: {{ formatDate(quiz.created_at) }}</p>
          </div>
          <div class="quiz-actions">
            <button
              @click="editQuiz(quiz.id)"
              class="edit-btn"
              :disabled="isLoading"
              :title="'Edit ' + quiz.name"
            >
              ✏️
            </button>
            <button
              @click="deleteQuiz(quiz.id)"
              class="delete-btn"
              :disabled="isLoading"
              :title="'Delete ' + quiz.name"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from "vue";
import AdminMap from "./AdminMap.vue";

const props = defineProps({
  apiUrl: String,
});

const emit = defineEmits(["close", "gameSaved"]);

// Debug log props
console.log("AdminPanel mounted with props:", {
  apiUrl: props.apiUrl,
});

const activeTab = ref("create");
const tabs = ["create", "list"];
const isLoading = ref(false);
const isLoadingQuizzes = ref(false);
const message = ref("");
const messageType = ref("");
const editingQuizId = ref(null);

const formData = reactive({
  quizName: "",
  creatorName: "",
  photos: [
    { file: null, preview: "", lat: null, lng: null },
    { file: null, preview: "", lat: null, lng: null },
    { file: null, preview: "", lat: null, lng: null },
    { file: null, preview: "", lat: null, lng: null },
    { file: null, preview: "", lat: null, lng: null },
  ],
});

const myQuizzes = ref([]);

onMounted(() => {
  if (activeTab.value === "list") {
    loadMyQuizzes();
  }
});

// Watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === "list") {
    loadMyQuizzes();
  }
});

function onFileSelected(index, event) {
  const file = event.target.files[0];
  if (file) {
    formData.photos[index].file = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      formData.photos[index].preview = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function onCoordinatesSelected(index, coords) {
  formData.photos[index].lat = coords.lat;
  formData.photos[index].lng = coords.lng;
}

function resetForm() {
  formData.quizName = "";
  formData.creatorName = "";
  formData.photos.forEach((p) => {
    p.file = null;
    p.preview = "";
    p.lat = null;
    p.lng = null;
  });
  message.value = "";
}

async function saveGame() {
  // Validation
  if (!formData.quizName.trim()) {
    showMessage("Quiz name required", "error");
    return;
  }

  if (!formData.creatorName.trim()) {
    showMessage("Creator name required", "error");
    return;
  }

  const allValid = formData.photos.every(
    (p) => p.file && p.lat !== null && p.lng !== null,
  );

  if (!allValid) {
    showMessage("Fill all fields: 5 images + coordinates for each", "error");
    return;
  }

  // Additional validation: check that we have exactly 5 files
  const filledPhotos = formData.photos.filter((p) => p.file);
  if (filledPhotos.length !== 5) {
    showMessage(
      `You must upload exactly 5 images (current: ${filledPhotos.length})`,
      "error",
    );
    return;
  }

  isLoading.value = true;
  message.value = "";

  try {
    const gameData = formData.photos.map((p) => ({
      location: [p.lat, p.lng],
    }));

    const formDataToSend = new FormData();
    formDataToSend.append("quizName", formData.quizName);
    formDataToSend.append("creatorName", formData.creatorName);
    formDataToSend.append("gameData", JSON.stringify(gameData));

    // Append images in order
    formData.photos.forEach((p, index) => {
      if (p.file) {
        console.log(`Adding image ${index + 1}: ${p.file.name}`);
        formDataToSend.append("images", p.file);
      }
    });

    console.log("Sending quiz to API...", {
      quizName: formData.quizName,
      creatorName: formData.creatorName,
      photoCount: filledPhotos.length,
      isEditing: editingQuizId.value,
      apiUrl: props.apiUrl,
    });

    // Determine if we're creating or updating
    const isEditing = editingQuizId.value !== null;
    const url = isEditing
      ? `${props.apiUrl}/api/quizzes/${editingQuizId.value}`
      : `${props.apiUrl}/api/quizzes`;
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      body: formDataToSend,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Failed to save quiz (status: ${response.status})`,
      );
    }

    const successMsg = isEditing
      ? "Quiz updated successfully!"
      : "Quiz created successfully!";
    showMessage(`✅ ${successMsg}`, "success");

    // Reset edit mode
    editingQuizId.value = null;
    resetForm();

    setTimeout(() => {
      emit("gameSaved");
    }, 1500);
  } catch (err) {
    console.error("Save error:", err);
    showMessage(`❌ Error: ${err.message}`, "error");
  } finally {
    isLoading.value = false;
  }
}

async function loadMyQuizzes() {
  console.log("Loading quizzes...");
  isLoadingQuizzes.value = true;
  try {
    console.log("Fetching from:", `${props.apiUrl}/api/quizzes`);
    const response = await fetch(`${props.apiUrl}/api/quizzes`);

    console.log("Response status:", response.status);

    if (!response.ok) {
      throw new Error(`Failed to load quizzes: ${response.status}`);
    }

    const data = await response.json();
    console.log("Loaded quizzes:", data);
    myQuizzes.value = data.quizzes || [];
    console.log("Quizzes count:", myQuizzes.value.length);
  } catch (err) {
    console.error("Load quizzes error:", err);
    showMessage("Failed to load quizzes: " + err.message, "error");
  } finally {
    isLoadingQuizzes.value = false;
  }
}

async function deleteQuiz(quizId) {
  if (!confirm("Delete this quiz?")) return;

  isLoading.value = true;
  try {
    const response = await fetch(`${props.apiUrl}/api/quizzes/${quizId}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete quiz");

    showMessage("✅ Quiz deleted", "success");
    await loadMyQuizzes();
    emit("gameSaved");
  } catch (err) {
    console.error("Delete error:", err);
    showMessage(`❌ Error: ${err.message}`, "error");
  } finally {
    isLoading.value = false;
  }
}

async function editQuiz(quizId) {
  console.log("Editing quiz:", quizId);
  editingQuizId.value = quizId;
  isLoading.value = true;

  try {
    // Load quiz photos
    const response = await fetch(
      `${props.apiUrl}/api/quizzes/${quizId}/photos`,
    );

    if (!response.ok) {
      throw new Error("Failed to load quiz details");
    }

    const data = await response.json();
    const photos = data.photos || [];

    // Get quiz name and creator
    const quiz = myQuizzes.value.find((q) => q.id === quizId);
    formData.quizName = quiz ? quiz.name : "";
    formData.creatorName = quiz ? quiz.creator_name : "";

    // Load existing photos into form
    photos.forEach((photo, index) => {
      if (index < 5) {
        formData.photos[index].lat = photo.location[0];
        formData.photos[index].lng = photo.location[1];
        formData.photos[index].file = null;
        // Construct full URL for the image
        const imageUrl = photo.image.startsWith("http")
          ? photo.image
          : `${props.apiUrl}/${photo.image}`;
        formData.photos[index].preview = imageUrl;
        console.log(`Loaded photo ${index + 1}: ${imageUrl}`);
      }
    });

    // Switch to create tab for editing
    activeTab.value = "create";
    showMessage("📝 Edit mode - Update and save", "info");
  } catch (err) {
    console.error("Edit error:", err);
    showMessage(`❌ Error: ${err.message}`, "error");
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function showMessage(msg, type) {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = "";
  }, 5000);
}
</script>

<style scoped>
.admin-container {
  width: 100%;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
}

h2 {
  text-align: center;
  color: var(--color-text);
  margin-top: 0;
  margin-bottom: 2rem;
}

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--color-border);
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-button:hover {
  color: var(--color-text);
}

.admin-form {
  background: var(--color-bg-secondary);
  padding: 2rem;
  border-radius: 8px;
}

h3 {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 0.5rem;
  margin-top: 0;
}

h4 {
  color: var(--color-text);
  margin: 1.5rem 0 1rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.quiz-name-input,
.form-group input[type="file"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 1rem;
  box-sizing: border-box;
}

.quiz-name-input:focus,
.form-group input[type="file"]:focus,
.form-group input[type="number"]:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-input {
  border: 2px dashed var(--color-primary);
}

.photo-form-group {
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background: var(--color-bg);
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
}

.photo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.photo-header h4 {
  margin: 0;
}

.file-name {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-style: italic;
}

.image-preview {
  margin-top: 0.75rem;
  max-width: 150px;
}

.image-preview img {
  width: 100%;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.coordinates-display {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-primary);
  color: var(--color-text);
  font-weight: 500;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.save-btn,
.reset-btn,
.cancel-btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.save-btn {
  background: var(--color-primary);
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

.reset-btn {
  background: var(--color-border);
  color: var(--color-text);
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.cancel-btn {
  background: var(--color-border);
  color: var(--color-text);
}

.cancel-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.save-btn:disabled,
.reset-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  border-left: 4px solid;
}

.message.success {
  background: var(--color-success-bg);
  color: var(--color-success);
  border-left-color: var(--color-success);
}

.message.error {
  background: var(--color-error-bg);
  color: var(--color-error);
  border-left-color: var(--color-error);
}

.quizzes-list {
  background: var(--color-bg-secondary);
  padding: 2rem;
  border-radius: 8px;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.no-quizzes {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--color-bg);
  border-radius: 6px;
  color: var(--color-text-secondary);
}

.quizzes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.quiz-card {
  background: var(--color-bg);
  padding: 1.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}

.quiz-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary);
}

.quiz-info {
  flex: 1;
}

.quiz-info h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
}

.quiz-date {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.3s;
  margin-left: 1rem;
}

.delete-btn:hover:not(:disabled) {
  background: var(--color-error-bg);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .admin-container {
    padding: 1rem;
  }

  .admin-form {
    padding: 1rem;
  }

  .tabs {
    flex-direction: column;
  }

  .form-actions {
    flex-direction: column;
  }

  .quizzes-grid {
    grid-template-columns: 1fr;
  }

  .quiz-card {
    flex-direction: column;
    text-align: center;
  }

  .delete-btn {
    margin-left: 0;
    margin-top: 1rem;
  }
}

.admin-container {
  width: 100%;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
}

h2 {
  text-align: center;
  color: var(--color-text);
  margin-top: 0;
  margin-bottom: 2rem;
}

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--color-border);
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-button:hover {
  color: var(--color-text);
}

.admin-form {
  background: var(--color-bg-secondary);
  padding: 2rem;
  border-radius: 8px;
}

h3 {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 0.5rem;
  margin-top: 0;
}

h4 {
  color: var(--color-text);
  margin: 1.5rem 0 1rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.quiz-name-input,
.form-group input[type="file"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 1rem;
  box-sizing: border-box;
}

.quiz-name-input:focus,
.form-group input[type="file"]:focus,
.form-group input[type="number"]:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-input {
  border: 2px dashed var(--color-primary);
}

.photo-form-group {
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background: var(--color-bg);
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
}

.photo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.photo-header h4 {
  margin: 0;
}

.file-name {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-style: italic;
}

.image-preview {
  margin-top: 0.75rem;
  max-width: 150px;
}

.image-preview img {
  width: 100%;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.coordinates-display {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-primary);
  color: var(--color-text);
  font-weight: 500;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.save-btn,
.reset-btn,
.cancel-btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.save-btn {
  background: var(--color-primary);
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

.reset-btn {
  background: var(--color-border);
  color: var(--color-text);
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.cancel-btn {
  background: var(--color-border);
  color: var(--color-text);
}

.cancel-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.save-btn:disabled,
.reset-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  border-left: 4px solid;
}

.message.success {
  background: var(--color-success-bg);
  color: var(--color-success);
  border-left-color: var(--color-success);
}

.message.error {
  background: var(--color-error-bg);
  color: var(--color-error);
  border-left-color: var(--color-error);
}

.quizzes-list {
  background: var(--color-bg-secondary);
  padding: 2rem;
  border-radius: 8px;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.no-quizzes {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--color-bg);
  border-radius: 6px;
  color: var(--color-text-secondary);
}

.quizzes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.quiz-card {
  background: var(--color-bg);
  padding: 1.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}

.quiz-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary);
}

.quiz-info {
  flex: 1;
}

.quiz-info h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
}

.quiz-date {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.3s;
  margin-left: 1rem;
}

.delete-btn:hover:not(:disabled) {
  background: var(--color-error-bg);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .admin-container {
    padding: 1rem;
  }

  .admin-form {
    padding: 1rem;
  }

  .tabs {
    flex-direction: column;
  }

  .form-actions {
    flex-direction: column;
  }

  .quizzes-grid {
    grid-template-columns: 1fr;
  }

  .quiz-card {
    flex-direction: column;
    text-align: center;
  }

  .delete-btn,
  .edit-btn {
    margin-left: 0;
    margin-top: 1rem;
  }
}

/* Quiz actions in My Quizzes section */
.quiz-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-btn,
.delete-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.3s;
  flex: 1;
  text-align: center;
}

.edit-btn:hover:not(:disabled) {
  background: rgba(66, 184, 131, 0.1);
}

.delete-btn:hover:not(:disabled) {
  background: var(--color-error-bg);
}

.delete-btn:disabled,
.edit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
