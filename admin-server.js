import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

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
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quizzes table
    db.run(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        
        // Create migration user
        const migrationUser = 'migration_user';
        const hashedPassword = bcryptjs.hashSync('changeme123', 10);
        
        db.run(
          'INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)',
          [migrationUser, hashedPassword],
          function(err) {
            if (err) return;
            const userId = this.lastID;
            
            // Migrate each game as a quiz
            let quizCounter = 0;
            photosData.forEach((gamePhotos, gameIndex) => {
              db.run(
                'INSERT INTO quizzes (user_id, name) VALUES (?, ?)',
                [userId, `Quiz ${gameIndex + 1}`],
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
          }
        );
      } catch (e) {
        console.error('⚠️  Migration error:', e.message);
      }
    }
  });
}

// ===== AUTHENTICATION ROUTES =====

/**
 * POST /api/auth/signup
 * Create a new user account
 * Body: { username: string, password: string }
 */
app.post('/api/auth/signup', (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    // Hash password
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Insert user
    db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        const userId = this.lastID;
        const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        res.status(201).json({
          success: true,
          token,
          user: { id: userId, username }
        });
      }
    );
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 * Body: { username: string, password: string }
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    db.get(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isPasswordValid = bcryptjs.compareSync(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        res.json({
          success: true,
          token,
          user: { id: user.id, username: user.username }
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== MIDDLEWARE: Verify JWT Token =====
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// ===== QUIZZES ROUTES =====

/**
 * GET /api/quizzes
 * Get all quizzes for the authenticated user, sorted by creation date (newest first)
 * Headers: Authorization: Bearer <token>
 */
app.get('/api/quizzes', authenticateToken, (req, res) => {
  try {
    db.all(
      'SELECT id, name, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
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
 * Headers: Authorization: Bearer <token>
 */
app.get('/api/quizzes/:id/photos', authenticateToken, (req, res) => {
  try {
    const quizId = req.params.id;

    // Verify ownership
    db.get(
      'SELECT user_id FROM quizzes WHERE id = ?',
      [quizId],
      (err, quiz) => {
        if (err || !quiz) {
          return res.status(404).json({ error: 'Quiz not found' });
        }

        if (quiz.user_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

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
 * Headers: Authorization: Bearer <token>
 * Body (multipart/form-data): 
 *   - images: 5 image files
 *   - quizName: quiz name
 *   - gameData: JSON string with location data
 */
app.post('/api/quizzes', authenticateToken, upload.array('images', 5), (req, res) => {
  try {
    const { quizName, gameData } = req.body;

    if (!quizName || !quizName.trim()) {
      return res.status(400).json({ error: 'Quiz name required' });
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
      'INSERT INTO quizzes (user_id, name) VALUES (?, ?)',
      [req.user.id, quizName.trim()],
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
              quiz: { id: quizId, name: quizName }
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
 * Headers: Authorization: Bearer <token>
 */
app.delete('/api/quizzes/:id', authenticateToken, (req, res) => {
  try {
    const quizId = req.params.id;

    // Verify ownership
    db.get(
      'SELECT user_id FROM quizzes WHERE id = ?',
      [quizId],
      (err, quiz) => {
        if (err || !quiz) {
          return res.status(404).json({ error: 'Quiz not found' });
        }

        if (quiz.user_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

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
 * Headers: Authorization: Bearer <token>
 * Body (multipart/form-data): 
 *   - quizName: new quiz name (optional)
 *   - gameData: JSON string with location data (optional, must have 5 items if provided)
 *   - images: new image files (optional, can be 0-5 images)
 */
app.put('/api/quizzes/:id', authenticateToken, upload.array('images', 5), (req, res) => {
  try {
    const quizId = req.params.id;
    const { quizName, gameData } = req.body;

    // Verify ownership
    db.get(
      'SELECT user_id, name FROM quizzes WHERE id = ?',
      [quizId],
      (err, quiz) => {
        if (err || !quiz) {
          return res.status(404).json({ error: 'Quiz not found' });
        }

        if (quiz.user_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Update quiz name if provided
        if (quizName && quizName.trim()) {
          db.run(
            'UPDATE quizzes SET name = ? WHERE id = ?',
            [quizName.trim(), quizId],
            (err) => {
              if (err) {
                console.error('Quiz name update error:', err);
                return res.status(500).json({ error: 'Failed to update quiz name' });
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
                  console.log(`✅ Quiz "${quizName}" updated successfully`);
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
🔐 JWT authentication enabled
  `);
});
