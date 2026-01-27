import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
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

// Configuration du stockage des fichiers avec noms sécurisés
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    // Génère un nom de fichier sécurisé sans caractères spéciaux
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const safeFilename = `photo_${timestamp}_${random}${ext}`;
    cb(null, safeFilename);
  }
});

const upload = multer({ storage });

// Route to save a new game (supports multiple games)
app.post('/api/save-game', upload.array('images', 5), (req, res) => {
  try {
    const parsedData = JSON.parse(req.body.gameData);
    const gameData = parsedData.gameData || parsedData;
    const photosPath = path.join(__dirname, 'photos.json');
    let allGames = [];
    if (fs.existsSync(photosPath)) {
      try {
        allGames = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
      } catch (e) {
        allGames = [];
      }
    }

    // Map original names to new safe filenames
    const updatedGameData = gameData.map((photo, index) => {
      if (req.files && req.files[index]) {
        const newFilename = req.files[index].filename;
        return {
          ...photo,
          image: `images/${newFilename}`
        };
      }
      return photo;
    });

    // Add the new game (array of 5 photos) to the list
    allGames.push(updatedGameData);

    // Write the updated games array to photos.json
    fs.writeFileSync(photosPath, JSON.stringify(allGames, null, 2));

    res.json({
      success: true,
      message: 'Game saved successfully!',
      photosWritten: updatedGameData.length,
      files: updatedGameData.map(p => p.image)
    });
  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour vérifier le statut du serveur
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Serveur admin prêt' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Serveur admin lancé sur http://localhost:${PORT}`);
  console.log('📸 Les images seront sauvegardées dans le dossier /images');
  console.log('📋 Le fichier photos.json sera mis à jour automatiquement\n');
});
