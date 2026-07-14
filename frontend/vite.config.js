import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function serveDocsPlugin() {
  return {
    name: 'serve-docs',
    configureServer(server) {
      server.middlewares.use('/docs', (req, res, next) => {
        const filePath = resolve(__dirname, '..', 'docs', req.url.replace(/^\//, ''))
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (filePath.endsWith('.png'))  res.setHeader('Content-Type', 'image/png')
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg')
            res.end(fs.readFileSync(filePath))
          } else { next() }
        } catch { next() }
      })
    },
    writeBundle(options) {
      const src = resolve(__dirname, '..', 'docs', 'img')
      const dest = join(options.dir, 'docs', 'img')
      try {
        fs.mkdirSync(dest, { recursive: true })
        for (const file of fs.readdirSync(src)) {
          fs.copyFileSync(join(src, file), join(dest, file))
        }
      } catch (e) {
        console.warn('[serve-docs] Could not copy docs/img:', e.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), serveDocsPlugin()],
  server: {
    fs: { allow: ['..'] },
  },
})
