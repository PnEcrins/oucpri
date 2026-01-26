<template>
  <div class="game-container">
    <ImageMap 
      :photo="photo" 
      :onGuess="onGuess"
      :showLine="showLine"
      :userGuess="userGuess"
      :correctAnswer="correctAnswer"
    />
  </div>
</template>

<script setup>
import ImageMap from "./ImageMap.vue";

const props = defineProps({
  photo: Object,
  onGuess: Function,
  showLine: Boolean,
  userGuess: Object,
  correctAnswer: Array,
});
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
