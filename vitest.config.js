import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '$lib': path.resolve('./src/lib'),
            '$env/static/private': path.resolve('./src/tests/env-mock.js'),
            '$env/dynamic/private': path.resolve('./src/tests/env-mock.js'),
            '$app/environment': path.resolve('./src/tests/app-env-mock.js'),
        }
    },
    test: {
        globalSetup: ['src/tests/global-setup.js'],
        environment: 'node',
        include: ['src/**/*.test.js'],
        // Alla integrationstester delar samma in-memory-databas, och flera av
        // dem tömmer collections i beforeEach. Körs filerna parallellt raderar
        // de varandras data mitt i ett test.
        fileParallelism: false,
    }
});
