# OUCPRIS Codebase Instructions for AI Agents

## Project Overview

**OUCPRIS** is a Vue 3 geography quiz application where users create and play location-guessing games using photos and interactive maps. It's a full-stack app with **no authentication required**—all quizzes are publicly accessible. Users simply enter their name when creating quizzes.

## Architecture

### Stack & Key Technologies

- **Frontend**: Vue 3 (Composition API) + Vite (rolldown-vite) + Leaflet for maps
- **Backend**: Express.js (Node.js) + SQLite3 (no JWT/passwords)
- **Build & Run**: `npm run dev` (Vite frontend) + `npm run admin-server` (backend)
- **State**: All quiz data persisted in SQLite; no authentication state needed

### Data Flow & Service Boundaries

1. **Frontend** (`src/App.vue`, `src/components/`) → handles UI, game logic, quiz display
2. **Backend API** (`admin-server.js`, port 3001) → manages quizzes and photos (no user auth)
3. **Database** (`quiz.db`) → persists quizzes with creator names and photos
4. **Static Assets** (`images/`, `photos.json`) → quiz photos served via `/images` route

### Database Schema

```
quizzes (id, name, creator_name, created_at)
  ↓ 1:N (CASCADE)
photos (id, quiz_id, image_path, location_lat, location_lon)
```

**Key Pattern**: Each quiz has a `creator_name` TEXT field (user-provided, no verification). Foreign key `ON DELETE CASCADE` ensures photo deletion when quiz is deleted.

### Quiz Creation Flow

1. User enters quiz name + their name (creator_name)
2. Uploads 5 photos and clicks on map to set coordinates for each
3. Quiz created immediately (no login required)
4. All quizzes publicly accessible to all users
5. Anyone can edit/delete any quiz (no ownership check)

## Core Components & Responsibilities

### Frontend Components

- **`App.vue`**: Main orchestrator—quiz loading, game flow, tab navigation (Home/Admin), dark mode toggle
- **`GameStep.vue`**: Single quiz photo display; receives `onGuess` callback from parent
- **`ImageMap.vue`**: Leaflet map overlay—user clicks map to place marker, calculates distance to correct answer
- **`AdminPanel.vue`**: Create/edit/delete quizzes; file upload, map click to set coordinates (requires creator name)
- **`AdminMap.vue`**: Map for selecting photo coordinates during quiz creation

### Backend Endpoints (all publicly accessible, no auth required)

```
GET    /api/quizzes              - List all quizzes
GET    /api/quizzes/:id/photos   - Get quiz photos + coordinates
POST   /api/quizzes              - Create quiz (multipart: 5 images + name + creator_name + coordinates)
PUT    /api/quizzes/:id          - Update quiz metadata or photos
DELETE /api/quizzes/:id          - Delete quiz
GET    /api/health               - Server health check
```

## Developer Workflows

always run nvm use before run npm run dev or npm run admin-server

### Running the Application

```bash
# Terminal 1: Backend API (port 3001)
npm run admin-server

# Terminal 2: Frontend dev server (port 5173)
npm run dev
```

Access at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Vite's `copyFilesPlugin` in `vite.config.js` copies `images/` and `photos.json` to `dist/`.

### Database Initialization

- Auto-creates `quiz.db` on first admin-server startup
- Migrates legacy `photos.json` data to SQLite if DB is empty (all quizzes assigned to "Anonymous")
- PRAGMA foreign_keys enabled in db.run() call

## Project-Specific Patterns & Conventions

### Frontend Patterns

- **State Management**: Reactive refs/computed in components (no Vuex/Pinia)
- **API URL**: Controlled via `import.meta.env.VITE_API_URL` (defaults to `http://localhost:3001`)
- **Error Handling**: Check response.status; emit errors to template for user display
- **Props & Emits**: `defineProps()` and `defineEmits()` for component communication
- **Dark Mode**: Toggle stored in localStorage (`darkMode`), applied to document class
- **No Auth State**: No token or user refs needed; all data flows directly via API

### Backend Patterns

- **Middleware Chain**: `cors()` → `express.json()` → route handlers (no authenticateToken middleware)
- **File Upload**: Multer with safe filename generation (`photo_${timestamp}_${random}${ext}`)
- **DB Queries**: Use `db.get()` for single row, `db.all()` for multiple, `db.run()` for mutations
- **Response Format**: Always JSON with `error` or `message` fields on failure/success
- **No Ownership Checks**: Any quiz can be edited/deleted by anyone; no user_id verification

### File Organization

- **Components**: Grouped by feature (`GameStep`, `AdminPanel`) in `src/components/`
- **Static Files**: Quiz images in `images/`, metadata in `photos.json`
- **Backend Logic**: All in single `admin-server.js` file (compact, no routing modules)

## Critical Integration Points

### API to Database

- Quiz creation requires `name` and `creator_name` (TEXT fields, no verification)
- Photo coordinates stored as REAL (floats) for Leaflet compatibility
- Image paths relative to `http://localhost:3001/images/`
- No user_id or ownership tracking

### Frontend to API

- **No Authorization headers needed** - all fetch calls omit auth header
- Always check `response.ok` before parsing JSON
- Multipart file uploads: use FormData with `append('images', file)` array
- Include `creatorName` in POST/PUT requests for quiz creation/editing

### Map Interaction

- Leaflet bounds set to image dimensions (1920×1080 default in `ImageMap.vue`)
- Click handler converts map click → lat/lon → calculates distance to correct location
- Score formula: 5000 - (distance_in_km \* 100), min 0

## Debugging Tips

- Backend logs include console.log with emoji prefixes (`✅`, `❌`, `ℹ️`) for easy scanning
- Frontend checks `isDev` flag to allow admin access in development
- SQLite queries logged via `db.all/get/run()` callbacks
- Check Network tab for failed requests (will show 500 if DB schema mismatch)

## File References for Common Tasks

- **Add new API endpoint**: [admin-server.js](admin-server.js#L140-L170)
- **Component state pattern**: [App.vue](src/App.vue#L10-L25)
- **Quiz creation flow**: [AdminPanel.vue](src/components/AdminPanel.vue#L200-L280)
- **Map interaction**: [ImageMap.vue](src/components/ImageMap.vue#L38-L60)
- **Quiz form with creator name**: [AdminPanel.vue](src/components/AdminPanel.vue#L22-L35)
