/** Creates a minimal in-memory cookie jar mimicking the SvelteKit Cookies interface. */
export function makeCookies(initial = {}) {
    const jar = new Map(Object.entries(initial));
    return {
        get: (name) => jar.get(name) ?? undefined,
        set: (name, value, _opts) => jar.set(name, value),
        delete: (name, _opts) => jar.delete(name),
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        jar,
    };
}

/** Creates a mock SvelteKit request event for POST handlers. */
export function makePostEvent(body, cookies = makeCookies(), ip = '127.0.0.1') {
    return {
        request: new Request('http://localhost', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
        cookies,
        getClientAddress: () => ip,
    };
}

/**
 * Creates a mock SvelteKit request event with both route params and a JSON body —
 * behövs av handlers under `[id]`, som `makePostEvent` inte täcker.
 */
export function makeBodyEvent(method, params, body, cookies = makeCookies()) {
    return {
        request: new Request('http://localhost', {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
        params,
        cookies,
        getClientAddress: () => '127.0.0.1',
    };
}

/** Creates a mock SvelteKit request event for GET/DELETE handlers. */
export function makeGetEvent(params = {}, cookies = makeCookies()) {
    return {
        request: new Request('http://localhost'),
        params,
        cookies,
        getClientAddress: () => '127.0.0.1',
    };
}
