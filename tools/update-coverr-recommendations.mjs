import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'src/assets/data/coverr-popular.json');
const apiKey = process.env.COVERR_API_KEY?.trim();

if (!apiKey) {
	throw new Error('The COVERR_API_KEY GitHub secret is missing.');
}

const params = new URLSearchParams({ sort: 'popularity', page_size: '12', urls: 'true' });
const response = await fetch(`https://api.coverr.co/videos?${params}`, {
	headers: { Accept: 'application/json', 'x-api-key': apiKey },
	signal: AbortSignal.timeout(25_000),
});

if (!response.ok) {
	throw new Error(`Coverr API request failed with status ${response.status}.`);
}

const payload = await response.json();
if (!Array.isArray(payload.hits) || payload.hits.length === 0) {
	throw new Error('Coverr API returned no popular videos; keeping the previous snapshot.');
}

const snapshot = {
	fetchedAt: new Date().toISOString(),
	hits: payload.hits.slice(0, 12),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Saved ${snapshot.hits.length} Coverr recommendations.`);
