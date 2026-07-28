import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x',
			// Samma region som MongoDB Atlas-klustret (Stockholm, aws eu-north-1).
			// Utan detta kör funktionerna i iad1 och varje DB-anrop kostar ~90 ms extra.
			regions: ['arn1']
		}),
		csp: {
			mode: 'nonce',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'connect-src': ['self'],
				'font-src': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
