import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

// Plugin pour copier les images et photos.json dans dist/
const copyFilesPlugin = () => {
  return {
    name: 'copy-game-files',
    apply: 'build',
    writeBundle() {
      const distDir = path.join(process.cwd(), 'dist')
      const imagesDir = path.join(distDir, 'images')
      const photosSource = path.join(process.cwd(), 'photos.json')
      const photosDest = path.join(distDir, 'photos.json')

      // Crée le dossier images s'il n'existe pas
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      // Copie les images
      const srcImagesDir = path.join(process.cwd(), 'images')
      if (fs.existsSync(srcImagesDir)) {
        const files = fs.readdirSync(srcImagesDir)
        files.forEach(file => {
          const src = path.join(srcImagesDir, file)
          const dest = path.join(imagesDir, file)
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest)
          }
        })
      }

      // Copie photos.json
      if (fs.existsSync(photosSource)) {
        fs.copyFileSync(photosSource, photosDest)
      }

      console.log('✅ Images et photos.json copiés dans dist/')
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), copyFilesPlugin()],
  publicDir: false,
  base: './',
  build: {
    assetsDir: 'assets'
  }
})

