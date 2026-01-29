import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// CORS configuration - allow all localhost origins
const corsOptions = {
  origin: /^http:\/\/localhost:\d+$/,
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve images as static files
app.use('/images', express.static(path.join(__dirname, 'images')));

// Multer configuration pour upload sécurisé
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const safeFilename = `photo_${timestamp}_${random}${ext}`;
    cb(null, safeFilename);
  }
});

const upload = multer({ storage });

// ===== DATABASE SETUP =====
const db = new sqlite3.Database('./quiz.db', (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
  console.log('✅ SQLite database connected');
  initializeDatabase();
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  db.serialize(() => {
    // Create quizzes table
    db.run(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create photos table
    db.run(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        location_lat REAL NOT NULL,
        location_lon REAL NOT NULL,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      )
    `, () => {
      migrateExistingPhotos();
    });
  });
}

// Migrate existing photos.json to SQLite
function migrateExistingPhotos() {
  const photosPath = path.join(__dirname, 'photos.json');
  
  db.get("SELECT COUNT(*) as count FROM quizzes", (err, row) => {
    if (err) return;
    
    if (row.count === 0 && fs.existsSync(photosPath)) {
      try {
        const photosData = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
        
        // Migrate each game as a quiz
        let quizCounter = 0;
        photosData.forEach((gamePhotos, gameIndex) => {
          db.run(
            'INSERT INTO quizzes (name, creator_name) VALUES (?, ?)',
            [`Quiz ${gameIndex + 1}`, 'Anonymous'],
            function(err) {
              if (err) return;
              const quizId = this.lastID;
              
              // Insert photos for this quiz
              gamePhotos.forEach(photo => {
                const [lat, lon] = photo.location;
                db.run(
                  'INSERT INTO photos (quiz_id, image_path, location_lat, location_lon) VALUES (?, ?, ?, ?)',
                  [quizId, photo.image, lat, lon]
                );
              });
              
              quizCounter++;
              if (quizCounter === photosData.length) {
                console.log(`✅ Migrated ${photosData.length} quizzes from photos.json`);
              }
            }
          );
        });
      } catch (e) {
        console.error('⚠️  Migration error:', e.message);
      }
    }
  });
}

// ===== QUIZZES ROUTES =====

/**
 * GET /api/quizzes
 * Get all quizzes, sorted by creation date (newest first)
 */
app.get('/api/quizzes', (req, res) => {
  try {
    db.all(
      'SELECT id, name, creator_name, created_at FROM quizzes ORDER BY created_at DESC',
      (err, quizzes) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, quizzes: quizzes || [] });
      }
    );
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/quizzes/:id/photos
 * Get all photos for a specific quiz
 */
app.get('/api/quizzes/:id/photos', (req, res) => {
  try {
    const quizId = req.params.id;

    db.all(
      'SELECT id, image_path, location_lat, location_lon FROM photos WHERE quiz_id = ? ORDER BY id',
      [quizId],
      (err, photos) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({
          success: true,
          photos: photos.map(p => ({
            id: p.id,
            image: p.image_path,
            location: [p.location_lat, p.location_lon]
          }))
        });
      }
    );
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/quizzes
 * Create a new quiz with 5 photos
 * Body (multipart/form-data): 
 *   - images: 5 image files
 *   - quizName: quiz name
 *   - creatorName: creator name
 *   - gameData: JSON string with location data
 */
app.post('/api/quizzes', upload.array('images', 5), (req, res) => {
  try {
    const { quizName, creatorName, gameData } = req.body;

    if (!quizName || !quizName.trim()) {
      return res.status(400).json({ error: 'Quiz name required' });
    }

    if (!creatorName || !creatorName.trim()) {
      return res.status(400).json({ error: 'Creator name required' });
    }

    if (!req.files || req.files.length === 0) {
      console.error('No files received. req.files:', req.files);
      return res.status(400).json({ error: 'Images are required' });
    }

    if (req.files.length !== 5) {
      console.error(`Exactly 5 images required, received ${req.files.length}`);
      return res.status(400).json({ error: `Exactly 5 images required (received ${req.files.length})` });
    }

    let photoData = [];
    try {
      photoData = JSON.parse(gameData);
    } catch (e) {
      console.error('Invalid game data format:', e.message);
      return res.status(400).json({ error: 'Invalid game data format' });
    }

    if (!Array.isArray(photoData) || photoData.length !== 5) {
      console.error(`Must provide exactly 5 photos with location data, received ${photoData.length}`);
      return res.status(400).json({ error: `Must provide exactly 5 photos with location data (received ${photoData.length})` });
    }

    // Validate all locations are arrays with 2 elements
    for (let i = 0; i < photoData.length; i++) {
      if (!photoData[i].location || !Array.isArray(photoData[i].location) || photoData[i].location.length !== 2) {
        console.error(`Invalid location data at index ${i}`);
        return res.status(400).json({ error: `Invalid location data at index ${i}` });
      }
      const [lat, lon] = photoData[i].location;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        console.error(`Location coordinates must be numbers at index ${i}`);
        return res.status(400).json({ error: `Location coordinates must be numbers at index ${i}` });
      }
    }

    // Create quiz
    db.run(
      'INSERT INTO quizzes (name, creator_name) VALUES (?, ?)',
      [quizName.trim(), creatorName.trim()],
      function(err) {
        if (err) {
          console.error('Quiz creation error:', err);
          return res.status(500).json({ error: 'Failed to create quiz' });
        }

        const quizId = this.lastID;
        const insertPromises = [];

        // Insert photos using promises - match files with location data
        req.files.forEach((file, index) => {
          if (index < photoData.length) {
            const filename = file.filename;
            const imagePath = `images/${filename}`;
            const [lat, lon] = photoData[index].location;

            console.log(`Inserting photo ${index + 1}: ${imagePath}, location: [${lat}, ${lon}]`);

            const promise = new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO photos (quiz_id, image_path, location_lat, location_lon) VALUES (?, ?, ?, ?)',
                [quizId, imagePath, lat, lon],
                function(err) {
                  if (err) {
                    console.error(`Error inserting photo ${index + 1}:`, err);
                    reject(err);
                  } else {
                    console.log(`Photo ${index + 1} inserted successfully`);
                    resolve();
                  }
                }
              );
            });
            
            insertPromises.push(promise);
          }
        });

        // Wait for all insertions
        Promise.all(insertPromises)
          .then(() => {
            console.log(`✅ Quiz "${quizName}" created successfully with ${insertPromises.length} photos`);
            res.status(201).json({
              success: true,
              message: 'Quiz created successfully!',
              quiz: { id: quizId, name: quizName, creator_name: creatorName }
            });
          })
          .catch((err) => {
            console.error('Photo insertion error:', err);
            res.status(500).json({ error: 'Failed to insert photos' });
          });
      }
    );
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * DELETE /api/quizzes/:id
 * Delete a quiz and all its photos (cascade)
 */
app.delete('/api/quizzes/:id', (req, res) => {
  try {
    const quizId = req.params.id;

    // Delete quiz (photos cascade delete due to foreign key)
    db.run(
      'DELETE FROM quizzes WHERE id = ?',
      [quizId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete quiz' });
        }
        res.json({ success: true, message: 'Quiz deleted successfully' });
      }
    );
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/quizzes/:id
 * Update a quiz name and/or photos
 * Body (multipart/form-data): 
 *   - quizName: new quiz name (optional)
 *   - creatorName: new creator name (optional)
 *   - gameData: JSON string with location data (optional, must have 5 items if provided)
 *   - images: new image files (optional, can be 0-5 images)
 */
app.put('/api/quizzes/:id', upload.array('images', 5), (req, res) => {
  try {
    const quizId = req.params.id;
    const { quizName, creatorName, gameData } = req.body;

    db.get(
      'SELECT name, creator_name FROM quizzes WHERE id = ?',
      [quizId],
      (err, quiz) => {
        if (err || !quiz) {
          return res.status(404).json({ error: 'Quiz not found' });
        }

        // Update quiz name/creator if provided
        if ((quizName && quizName.trim()) || (creatorName && creatorName.trim())) {
          db.run(
            'UPDATE quizzes SET name = ?, creator_name = ? WHERE id = ?',
            [quizName && quizName.trim() ? quizName.trim() : quiz.name, 
             creatorName && creatorName.trim() ? creatorName.trim() : quiz.creator_name, 
             quizId],
            (err) => {
              if (err) {
                console.error('Quiz update error:', err);
                return res.status(500).json({ error: 'Failed to update quiz' });
              }
            }
          );
        }

        // If images provided, update photos
        if (req.files && req.files.length > 0) {
          let photoData = [];
          
          if (gameData) {
            try {
              photoData = JSON.parse(gameData);
            } catch (e) {
              return res.status(400).json({ error: 'Invalid game data format' });
            }
          }

          if (photoData.length !== req.files.length) {
            return res.status(400).json({ 
              error: `Number of location data (${photoData.length}) must match number of images (${req.files.length})` 
            });
          }

          // Delete old photos
          db.run(
            'DELETE FROM photos WHERE quiz_id = ?',
            [quizId],
            (err) => {
              if (err) {
                console.error('Photo deletion error:', err);
                return res.status(500).json({ error: 'Failed to delete old photos' });
              }

              // Insert new photos
              const insertPromises = [];
              req.files.forEach((file, index) => {
                const filename = file.filename;
                const imagePath = `images/${filename}`;
                const [lat, lon] = photoData[index].location;

                const promise = new Promise((resolve, reject) => {
                  db.run(
                    'INSERT INTO photos (quiz_id, image_path, location_lat, location_lon) VALUES (?, ?, ?, ?)',
                    [quizId, imagePath, lat, lon],
                    function(err) {
                      if (err) {
                        reject(err);
                      } else {
                        resolve();
                      }
                    }
                  );
                });
                
                insertPromises.push(promise);
              });

              Promise.all(insertPromises)
                .then(() => {
                  console.log(`✅ Quiz updated successfully`);
                  res.json({
                    success: true,
                    message: 'Quiz updated successfully!',
                    quiz: { id: quizId, name: quizName || quiz.name }
                  });
                })
                .catch((err) => {
                  console.error('Photo insertion error:', err);
                  res.status(500).json({ error: 'Failed to insert new photos' });
                });
            }
          );
        } else {
          // Just update name, no images
          res.json({
            success: true,
            message: 'Quiz updated successfully!',
            quiz: { id: quizId, name: quizName || quiz.name }
          });
        }
      }
    );
  } catch (error) {
    console.error('Quiz update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin server ready' });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
✅ Admin server running on http://localhost:${PORT}
📸 Images saved to /images folder
🗄️  Database: quiz.db
� No authentication required - all quizzes are public
  `);
});
