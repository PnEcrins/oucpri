# OUCPRI

Une application web interactive pour créer et jouer à des jeux de localisation. Devinez les lieux à partir de photos et testez vos connaissances géographiques !

## 🎮 Fonctionnalités

### Pour les joueurs
- **Jouer à des quiz** : Devinez la localisation des photos sur une carte
- **Partager des quiz** : Obtenez un lien partageable pour inviter d'autres joueurs
- **Voir les résultats** : Recevez un score détaillé avec distance et points

### Pour les créateurs
- **Créer des quiz** : Upload 5 photos avec leurs coordonnées exactes
- **Éditer les quiz** : Modifiez le nom, les photos ou les coordonnées
- **Supprimer les quiz** : Gérez vos quizzes personnalisés
- **Voir vos quiz** : Liste complète de vos créations

### Fonctionnalités générales
- **Authentification sécurisée** : Inscrivez-vous et connectez-vous avec JWT
- **Mode sombre** : Basculez entre les thèmes clair et sombre
- **Interface responsive** : Fonctionne sur desktop, tablette et mobile
- **Partage facile** : Copiez le lien du quiz et partagez-le

## 🚀 Installation

### Prérequis
- **Node.js** (v16 ou supérieur)
- **npm** (généralement installé avec Node.js)
- **SQLite3** (optionnel, la base de données est créée automatiquement)

### 1. Cloner le repository

```bash
git clone <repository-url>
cd oucpri
```

### 2. Installer les dépendances

```bash
npm install
```

Cela installera :
- Vue 3 (framework frontend)
- Vite (bundler)
- Express (serveur backend)
- SQLite3 (base de données)
- Leaflet (cartes)
- Autres dépendances nécessaires

### 3. Créer la base de données

La base de données SQLite est créée **automatiquement** au premier démarrage du serveur admin. Aucune action manuelle n'est nécessaire.

```bash
# La base de données sera créée dans le répertoire racine
# Fichier: quiz.db
```

## 🏃 Démarrage

### Option 1 : Démarrage complet (recommandé)

```bash
# Terminal 1 - Serveur API
npm run admin-server

# Terminal 2 - Application Vue
npm run dev
```

### Option 2 : Seulement l'application Vue (sans création/édition de quiz)

```bash
npm run dev
```

### Accéder à l'application

- **Application** : http://localhost:5173
- **Serveur API** : http://localhost:3001

## 📖 Guide d'utilisation

### Première visite

1. **S'inscrire** : Créez un compte avec un nom d'utilisateur et un mot de passe
2. **Se connecter** : Utilisez vos identifiants
3. **Page d'accueil** : Voir la liste de vos quiz

### Créer un quiz

1. Cliquez sur **⚙️ Admin** (en haut à droite)
2. Sélectionnez l'onglet **➕ Create New**
3. Entrez le nom du quiz
4. Pour chaque image (5 au total) :
   - Uploadez une photo
   - Cliquez sur la carte pour sélectionner les coordonnées
5. Cliquez sur **💾 Create Quiz**

### Éditer un quiz

1. Cliquez sur **⚙️ Admin**
2. Sélectionnez l'onglet **📚 My Quizzes**
3. Cliquez sur **✏️ Edit** sur le quiz à modifier
4. Apportez vos modifications
5. Cliquez sur **💾 Update Quiz**

### Supprimer un quiz

1. Cliquez sur **⚙️ Admin**
2. Sélectionnez l'onglet **📚 My Quizzes**
3. Cliquez sur **🗑️** pour supprimer

### Jouer à un quiz

1. Depuis la page d'accueil, cliquez sur **▶️ Play**
2. Pour chaque photo :
   - Cliquez sur la carte pour faire votre devinette
   - Cliquez sur **Valider et voir le résultat**
3. Voyez votre score final et les détails

### Partager un quiz

1. Depuis la page d'accueil, cliquez sur **🔗 Share**
2. Le lien est copié dans le presse-papiers
3. Partagez le lien avec d'autres !

## 🗂️ Structure du projet

```
oucpri/
├── admin-server.js           # Serveur API Express
├── package.json              # Dépendances npm
├── vite.config.js            # Configuration Vite
├── index.html                # Page HTML principal
├── src/
│   ├── main.js               # Point d'entrée Vue
│   ├── App.vue               # Composant principal
│   ├── style.css             # Styles globaux
│   ├── components/
│   │   ├── LoginPage.vue     # Page de connexion
│   │   ├── AdminPanel.vue    # Panneau admin (création/édition)
│   │   ├── GameStep.vue      # Écran de jeu
│   │   ├── AdminMap.vue      # Carte pour sélection coordonnées
│   │   └── ImageMap.vue      # Carte pour affichage résultat
│   └── assets/               # Images et ressources
├── images/                   # Dossier des images uploadées (gitignored)
├── quiz.db                   # Base de données SQLite (gitignored)
└── README.md                 # Ce fichier
```

## 🗄️ Structure de la base de données

La base de données SQLite contient 3 tables :

### Utilisateurs
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Quizzes
```sql
CREATE TABLE quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### Photos
```sql
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  location_lat REAL NOT NULL,
  location_lon REAL NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
)
```

## 🔐 Sécurité

- **Mots de passe** : Hashés avec bcryptjs (10 rounds)
- **Authentification** : Utilise JWT (JSON Web Tokens)
- **Token d'expiration** : 24 heures
- **CORS** : Restreint aux origines localhost
- **Clé secrète JWT** : À modifier en production via `process.env.JWT_SECRET`

## 📡 API Endpoints

### Authentification
- `POST /api/auth/signup` - Créer un compte
- `POST /api/auth/login` - Se connecter

### Quizzes
- `GET /api/quizzes` - Liste de tous vos quiz
- `GET /api/quizzes/:id/photos` - Photos d'un quiz
- `POST /api/quizzes` - Créer un quiz
- `PUT /api/quizzes/:id` - Modifier un quiz
- `DELETE /api/quizzes/:id` - Supprimer un quiz

### Santé
- `GET /api/health` - Vérifier si le serveur est actif

## 🛠️ Variables d'environnement

Créez un fichier `.env` à la racine (optionnel) :

```env
# Serveur API
PORT=3001
JWT_SECRET=your-secret-key-change-in-production

# Frontend
VITE_API_URL=http://localhost:3001
```

## 🐛 Dépannage

### La base de données ne se crée pas
- Vérifiez que `npm run admin-server` s'exécute sans erreurs
- Vérifiez les permissions du dossier (doit être writable)

### Les images ne s'affichent pas
- Assurez-vous que `npm run admin-server` s'exécute
- Vérifiez que le dossier `images/` existe et contient les photos

### Erreur d'authentification
- Vérifiez que le token JWT est valide
- Tentez de vous reconnecter
- Vérifiez la clé secrète JWT

### CORS errors
- Assurez-vous que le frontend et backend tournent sur localhost
- Vérifiez les ports (5173 pour Vue, 3001 pour Express)

## 📦 Technologies utilisées

- **Frontend** : Vue 3 + Vite
- **Backend** : Node.js + Express
- **Base de données** : SQLite3
- **Cartes** : Leaflet
- **Authentification** : JWT + bcryptjs
- **Styles** : CSS3 (variables CSS)

## 📄 License

Ce projet est sous licence MIT.

## 👨‍💻 Contribution

Les contributions sont bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Envoyer des pull requests

---

**Amusez-vous à jouer et créer des quiz ! 🗺️**
