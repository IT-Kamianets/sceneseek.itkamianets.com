const apiKey = process.env.COVERR_API_KEY?.trim();

module.exports = {
	'^/coverr-api': {
		target: 'https://api.coverr.co',
		changeOrigin: true,
		secure: true,
		rewrite: (path) => path.replace(/^\/coverr-api/u, ''),
		headers: apiKey ? { 'x-api-key': apiKey } : {},
	},
};
