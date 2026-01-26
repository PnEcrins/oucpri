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

// Middleware
app.use(cors());
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

// Route pour sauvegarder le jeu
app.post('/api/save-game', upload.array('images', 5), (req, res) => {
  try {
    const gameData = JSON.parse(req.body.gameData);
    const photosPath = path.join(__dirname, 'photos.json');
    
    // Mappe les anciens noms aux nouveaux noms de fichiers
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
    
    // Écrit le fichier photos.json avec les nouveaux noms
    fs.writeFileSync(photosPath, JSON.stringify(updatedGameData, null, 2));
    
    res.json({
      success: true,
      message: 'Jeu sauvegardé avec succès !',
      photosWritten: updatedGameData.length,
      files: updatedGameData.map(p => p.image)
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
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
