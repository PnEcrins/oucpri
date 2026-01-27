<template>
  <div class="admin-container">
    <h2>Create a new game</h2>
    <div class="instructions">
      <h4>📋 Instructions:</h4>
      <ol>
        <li>
          Start the admin server: <code>npm run admin-server</code> (in another
          terminal)
        </li>
        <li>Upload 5 images in this interface</li>
        <li>Click on the map to select coordinates for each image</li>
        <li>Click "Save game" to add a new game (series of 5 photos)</li>
        <li>
          Images will be stored in <code>/images</code> and
          <code>photos.json</code> will be updated automatically
        </li>
        <li>Run <code>npm run build</code></li>
        <li>Push the <code>dist/</code> folder to GitHub Pages</li>
      </ol>
    </div>
    <div class="admin-form">
      <h3>Upload 5 images</h3>

      <div
        v-for="(photo, index) in formPhotos"
        :key="index"
        class="photo-form-group"
      >
        <div class="photo-header">
          <h4>Image {{ index + 1 }}</h4>
          <span v-if="photo.file" class="file-name">{{ photo.file.name }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Choisir une image</label>
            <input
              type="file"
              accept="image/*"
              @change="(e) => onFileSelected(index, e)"
              class="file-input"
            />
            <div v-if="photo.file" class="image-preview">
              <img :src="photo.preview" :alt="`Aperçu ${index + 1}`" />
            </div>
          </div>
        </div>

        <AdminMap
          v-if="photo.file"
          :currentLat="photo.lat"
          :currentLng="photo.lng"
          @update:coordinates="(coords) => onCoordinatesSelected(index, coords)"
        />
      </div>

      <div class="form-actions">
        <button @click="saveGame" class="save-btn">Save game</button>
        <button @click="$emit('close')" class="cancel-btn">Cancel</button>
      </div>
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import AdminMap from "./AdminMap.vue";

const emit = defineEmits(["close", "gameSaved"]);

const formPhotos = reactive([
  { file: null, preview: "", lat: null, lng: null },
  { file: null, preview: "", lat: null, lng: null },
  { file: null, preview: "", lat: null, lng: null },
  { file: null, preview: "", lat: null, lng: null },
  { file: null, preview: "", lat: null, lng: null },
]);

const message = ref("");
const messageType = ref("");

function onFileSelected(index, event) {
  const file = event.target.files[0];
  if (file) {
    formPhotos[index].file = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      formPhotos[index].preview = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function onCoordinatesSelected(index, coords) {
  formPhotos[index].lat = coords.lat;
  formPhotos[index].lng = coords.lng;
}

function saveGame() {
  // Valide que toutes les images et coordonnées sont remplies
  const allValid = formPhotos.every(
    (p) => p.file && p.lat !== null && p.lng !== null,
  );

  if (!allValid) {
    message.value = "Please fill all fields (5 images + coordinates)";
    messageType.value = "error";
    setTimeout(() => (message.value = ""), 3000);
    return;
  }

  // Create the game JSON (the server will generate image filenames)
  const gameData = formPhotos.map((p, i) => ({
    image: "", // Will be set by the server
    location: [p.lat, p.lng],
  }));

  // Prepare the form for upload
  const formData = new FormData();
  formPhotos.forEach((p, i) => {
    if (p.file) {
      formData.append("images", p.file);
    }
  });
  formData.append("gameData", JSON.stringify({ gameData }));

  // Send to server
  fetch("http://localhost:3001/api/save-game", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        message.value = `✅ Game saved! ${data.photosWritten} photos written to /images and photos.json updated.`;
        messageType.value = "success";
        setTimeout(() => emit("gameSaved"), 2000);
      } else {
        message.value = `❌ Error: ${data.error}`;
        messageType.value = "error";
      }
    })
    .catch((err) => {
      message.value = `❌ Server connection error: ${err.message}. Make sure the server is running with \"npm run admin-server\"`;
      messageType.value = "error";
    });

  setTimeout(() => (message.value = ""), 5000);
}
</script>

<style scoped>
.admin-container {
  width: 100%;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
}

h2 {
  color: #333;
  margin-top: 0;
}

.admin-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h3 {
  color: #42b883;
  border-bottom: 2px solid #42b883;
  padding-bottom: 0.5rem;
}

.instructions {
  background: #e8f5e9;
  border-left: 4px solid #42b883;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 2rem;
}

.instructions h4 {
  margin-top: 0;
  color: #2e7d32;
}

.instructions ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  color: #555;
}

.instructions li {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.instructions code {
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: monospace;
  color: #d32f2f;
  font-weight: 600;
}

.photo-form-group {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f5f5f5;
  border-radius: 6px;
  border-left: 4px solid #42b883;
}

.photo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.photo-header h4 {
  margin: 0;
  color: #333;
}

.file-name {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  min-width: 200px;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.form-group input[type="file"] {
  width: 100%;
  padding: 0.5rem;
  border: 2px dashed #42b883;
  border-radius: 6px;
  cursor: pointer;
}

.form-group input[type="number"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.image-preview {
  margin-top: 0.5rem;
  max-width: 150px;
}

.image-preview img {
  width: 100%;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.save-btn,
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
  background: #42b883;
  color: white;
}

.save-btn:hover {
  background: #359268;
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

.cancel-btn {
  background: #ddd;
  color: #555;
}

.cancel-btn:hover {
  background: #ccc;
}

.message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

@media (max-width: 900px) {
  .admin-container {
    padding: 1rem;
  }

  .admin-form {
    padding: 1rem;
  }

  .form-row {
    flex-direction: column;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
