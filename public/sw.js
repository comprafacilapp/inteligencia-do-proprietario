const CACHE_NAME = 'prevanzia-pwa-v1';

// Ativa o novo Service Worker sem guardar
// dados financeiros ou páginas antigas em cache.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Remove caches antigos deste aplicativo.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();

      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith('prevanzia-pwa-'))
          .map((nome) => caches.delete(nome))
      );

      await self.clients.claim();
    })()
  );
});

// As requisições continuam usando a rede.
// Não armazenamos respostas nem dados financeiros.
self.addEventListener('fetch', () => {});
