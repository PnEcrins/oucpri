<template>
  <div class="admin-map-wrapper">
    <h4>Sélectionner la localisation sur la carte</h4>
    <p class="hint">Cliquez sur la carte pour choisir les coordonnées</p>
    <div class="admin-map-container" ref="mapContainer"></div>
    <div v-if="selectedLatLng" class="selected-coords">
      <p><strong>Localisation sélectionnée :</strong></p>
      <p>Latitude : {{ selectedLatLng.lat.toFixed(4) }}</p>
      <p>Longitude : {{ selectedLatLng.lng.toFixed(4) }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  currentLat: Number,
  currentLng: Number
})

const emit = defineEmits(['update:coordinates'])

const mapContainer = ref(null)
let map = null
let marker = null
const selectedLatLng = ref(null)

if (props.currentLat && props.currentLng) {
  selectedLatLng.value = { lat: props.currentLat, lng: props.currentLng }
}

onMounted(() => {
  // Initialise la carte centrée sur le monde
  const defaultLat = props.currentLat || 20
  const defaultLng = props.currentLng || 0
  
  map = L.map(mapContainer.value).setView([defaultLat, defaultLng], 3)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)
  
  // Si on a déjà des coordonnées, ajoute un marqueur
  if (props.currentLat && props.currentLng) {
    marker = L.marker([props.currentLat, props.currentLng]).addTo(map)
  }
  
  // Écoute les clics sur la carte
  map.on('click', (e) => {
    const { lat, lng } = e.latlng
    selectedLatLng.value = { lat, lng }
    
    // Ajoute ou déplace le marqueur
    if (marker) {
      map.removeLayer(marker)
    }
    marker = L.marker([lat, lng]).addTo(map)
    
    // Émet l'événement pour mettre à jour le parent
    emit('update:coordinates', { lat, lng })
  })
})
</script>

<style scoped>
.admin-map-wrapper {
  margin: 1rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.admin-map-wrapper h4 {
  margin-top: 0;
  color: #333;
}

.hint {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
  margin: 0.5rem 0;
}

.admin-map-container {
  width: 100%;
  height: 300px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.selected-coords {
  background: white;
  padding: 1rem;
  border-left: 4px solid #42b883;
  border-radius: 4px;
  margin-top: 1rem;
}

.selected-coords p {
  margin: 0.25rem 0;
  color: #555;
  font-size: 0.95rem;
}

.selected-coords strong {
  color: #333;
}
</style>
