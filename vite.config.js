import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        sveltekit(),
        SvelteKitPWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'MazeShopper',
                short_name: 'MazeShopper',
                description: 'Din smarta inköpslista',
                theme_color: '#f97316',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/',
                lang: 'sv',
                icons: [
                    {
                        src: '/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: '/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: '/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                // Cache static assets
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                // Don't cache API routes
                navigateFallbackDenylist: [/^\/api\//]
            },
            devOptions: {
                enabled: true
            }
        })
    ]
});
