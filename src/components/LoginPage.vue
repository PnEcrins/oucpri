<script setup>
import { ref } from 'vue';

const emit = defineEmits(['login']);

const isLogin = ref(true);
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const isLoading = ref(false);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const toggleMode = () => {
  isLogin.value = !isLogin.value;
  error.value = '';
  username.value = '';
  password.value = '';
  confirmPassword.value = '';
};

const validateForm = () => {
  if (!username.value.trim()) {
    error.value = 'Username required';
    return false;
  }

  if (username.value.length < 3) {
    error.value = 'Username must be at least 3 characters';
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username.value)) {
    error.value = 'Username can only contain letters, numbers, underscores, and hyphens';
    return false;
  }

  if (!password.value) {
    error.value = 'Password required';
    return false;
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters';
    return false;
  }

  if (!isLogin.value && password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return false;
  }

  return true;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  error.value = '';

  if (!validateForm()) {
    return;
  }

  isLoading.value = true;
  console.log('Submitting form...', {
    mode: isLogin.value ? 'login' : 'signup',
    username: username.value,
    apiUrl: API_URL
  });

  try {
    const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/signup';
    const url = `${API_URL}${endpoint}`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', data);

    if (!response.ok) {
      error.value = data.error || 'An error occurred';
      console.error('Login failed:', error.value);
      isLoading.value = false;
      return;
    }

    console.log('Login successful! Token:', data.token ? data.token.substring(0, 20) + '...' : 'none');
    
    // Store token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    console.log('Token saved to localStorage');
    console.log('Verification - token in storage:', localStorage.getItem('token') ? 'yes' : 'no');

    // Emit login event with both user and token
    emit('login', {
      ...data.user,
      token: data.token
    });
  } catch (err) {
    error.value = 'Network error: ' + err.message;
    console.error('Network error:', err);
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>OUCPRI</h1>
      <p class="subtitle">Location Guessing Game</p>

      <form @submit="handleSubmit">
        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="Enter username"
            :disabled="isLoading"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            :disabled="isLoading"
            autocomplete="current-password"
          />
        </div>

        <div v-if="!isLogin" class="form-group">
          <label for="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm password"
            :disabled="isLoading"
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up' }}
        </button>
      </form>

      <div class="toggle-mode">
        <p v-if="isLogin">
          Don't have an account?
          <button type="button" @click="toggleMode" :disabled="isLoading">
            Sign up
          </button>
        </p>
        <p v-else>
          Already have an account?
          <button type="button" @click="toggleMode" :disabled="isLoading">
            Login
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: var(--color-bg-card);
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

h1 {
  text-align: center;
  margin: 0 0 10px 0;
  color: var(--color-primary);
  font-size: 32px;
}

.subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin: 0 0 30px 0;
  font-size: 14px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--color-text);
  font-size: 14px;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 14px;
  border-left: 4px solid var(--color-error);
}

.toggle-mode {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.toggle-mode p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.toggle-mode button {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  text-decoration: underline;
  transition: color 0.3s;
}

.toggle-mode button:hover:not(:disabled) {
  color: var(--color-primary-hover);
}

.toggle-mode button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
