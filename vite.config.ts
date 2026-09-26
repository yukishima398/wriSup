import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// devサーバーは /about/ をSPAのindex.htmlにフォールバックしてしまうため、
// 本番(Cloudflare Pages)と同じく public/about/index.html を返すよう書き換える
function staticAboutPage(): Plugin {
  return {
    name: 'static-about-page',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/about' || req.url === '/about/') {
          req.url = '/about/index.html'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    staticAboutPage(),
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})