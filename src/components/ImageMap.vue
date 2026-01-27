<template>
  <div class="image-map-container">
    <div class="leaflet-image-map" ref="imageMapContainer"></div>
    <div class="map-container" ref="mapContainer"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props = defineProps({
  photo: Object,
  onGuess: Function,
  showLine: Boolean,
  userGuess: Object,
  correctAnswer: Array,
});

const imageMapContainer = ref(null);
const mapContainer = ref(null);
let imageMap = null;
let map = null;
let marker = null;
let correctMarker = null;
let line = null;

onMounted(() => {
  // Carte Leaflet pour l'image (zoom/pan sur l'image)
  imageMap = L.map(imageMapContainer.value, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 4,
    zoomControl: true,
    attributionControl: false,
  });
  const w = 1920; // Largeur image (px) à adapter
  const h = 1080; // Hauteur image (px) à adapter
  const bounds = [
    [0, 0],
    [h, w],
  ];
  L.imageOverlay(props.photo.image, bounds).addTo(imageMap);
  imageMap.fitBounds(bounds);

  // Carte Leaflet pour la localisation
  map = L.map(mapContainer.value).setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
  map.on("click", (e) => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    props.onGuess(e.latlng);
  });
});

watch(
  () => props.showLine,
  (newShowLine) => {
    if (!map) return;

    if (newShowLine && props.userGuess && props.correctAnswer) {
      console.log(
        "Affichage de la ligne:",
        props.userGuess,
        props.correctAnswer,
      );

      // Nettoie les anciens marqueurs/ligne
      if (correctMarker) map.removeLayer(correctMarker);
      if (line) map.removeLayer(line);

      // Assure que le marqueur utilisateur existe
      if (!marker || marker.getLatLng().lat !== props.userGuess.lat) {
        if (marker) map.removeLayer(marker);
        marker = L.marker(props.userGuess).addTo(map);
      }

      // Ajoute un marqueur pour la solution exacte (vert)
      correctMarker = L.marker(props.correctAnswer, {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map);

      // Dessine une ligne entre le pointage et la solution
      line = L.polyline([props.userGuess, props.correctAnswer], {
        color: "red",
        weight: 3,
        opacity: 0.8,
        dashArray: "5, 5",
      }).addTo(map);

      // Zoome sur la zone contenant les deux points
      if (marker) {
        const group = L.featureGroup([marker, correctMarker]);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    } else {
      // Nettoie la ligne et le marqueur correct quand on change de photo
      if (correctMarker) {
        map.removeLayer(correctMarker);
        correctMarker = null;
      }
      if (line) {
        map.removeLayer(line);
        line = null;
      }
    }
  },
);

watch(
  () => props.photo,
  (newPhoto) => {
    // Reset image map
    if (imageMap) {
      imageMap.eachLayer((l) => imageMap.removeLayer(l));
      const w = 1920,
        h = 1080;
      const bounds = [
        [0, 0],
        [h, w],
      ];
      L.imageOverlay(newPhoto.image, bounds).addTo(imageMap);
      imageMap.fitBounds(bounds);
    }
    // Reset localisation map
    if (map) {
      map.setView([20, 0], 2);
      // Efface les couches sauf le fond de carte
      map.eachLayer((l) => {
        if (l instanceof L.Polyline || l instanceof L.Marker) {
          map.removeLayer(l);
        }
      });
    }
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
  },
);
</script>

<style scoped>
.image-map-container {
  display: flex;
  gap: 2%;
  width: 100%;
  height: 400px;
}
.leaflet-image-map {
  width: 45%;
  height: 100%;
  border-radius: 8px;
  border: 1px solid #ccc;
  overflow: hidden;
}
.map-container {
  width: 45%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 8px;
}
@media (max-width: 900px) {
  .image-map-container {
    flex-direction: column;
    height: auto;
  }
  .leaflet-image-map,
  .map-container {
    width: 100%;
    height: 300px;
  }
}
</style>
