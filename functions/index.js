const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');

const coverrApiKey = defineSecret('COVERR_API_KEY');
const allowedOrigin = 'https://sceneseek.itkamianets.com';
const requestWindowMs = 60 * 60 * 1000;
const requestLimitPerHour = 45;
let requestWindowStartedAt = Date.now();
let requestsThisWindow = 0;

exports.coverrSearch = onRequest(
	{
		region: 'europe-west1',
		cors: [allowedOrigin],
		maxInstances: 1,
		timeoutSeconds: 30,
		memory: '256MiB',
		secrets: [coverrApiKey],
	},
	async (request, response) => {
		if (request.method !== 'GET') {
			response.set('Allow', 'GET');
			response.status(405).json({ error: 'Method not allowed.' });
			return;
		}

		const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
		if (!query || query.length > 160) {
			response.status(400).json({ error: 'Provide a search query up to 160 characters.' });
			return;
		}

		const now = Date.now();
		if (now - requestWindowStartedAt >= requestWindowMs) {
			requestWindowStartedAt = now;
			requestsThisWindow = 0;
		}
		if (requestsThisWindow >= requestLimitPerHour) {
			response.status(429).json({ error: 'Search rate limit reached. Try again later.' });
			return;
		}
		requestsThisWindow += 1;

		const apiKey = coverrApiKey.value();
		if (!apiKey) {
			response.status(503).json({ error: 'Coverr API key is not configured.' });
			return;
		}

		const params = new URLSearchParams({
			query,
			page_size: '12',
			urls: 'true',
		});

		try {
			const upstream = await fetch(`https://api.coverr.co/videos?${params.toString()}`, {
				headers: { Accept: 'application/json', 'x-api-key': apiKey },
			});
			const body = await upstream.json();
			response.set('Cache-Control', 'public, max-age=60');
			response.status(upstream.status).json(body);
		} catch {
			response.status(502).json({ error: 'Coverr could not be reached.' });
		}
	},
);
