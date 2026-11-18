import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'src/assets/data/coverr-popular.json');
const apiKey = process.env.COVERR_API_KEY?.trim();

if (!apiKey) {
	throw new Error('The COVERR_API_KEY GitHub secret is missing.');
}

const pageSize = 12;
const pageCount = 5;
const pages = await Promise.all(
	Array.from({ length: pageCount }, async (_, page) => {
		const params = new URLSearchParams({
			sort: 'popular',
			page: String(page),
			page_size: String(pageSize),
			urls: 'true',
		});
		const response = await fetch(`https://api.coverr.co/videos?${params}`, {
			headers: { Accept: 'application/json', 'x-api-key': apiKey },
			signal: AbortSignal.timeout(25_000),
		});

		if (!response.ok) {
			throw new Error(`Coverr API request for page ${page + 1} failed with status ${response.status}.`);
		}
		return response.json();
	}),
);

const firstPage = pages[0];
const hits = pages.flatMap((payload) => (Array.isArray(payload.hits) ? payload.hits : []));
if (hits.length === 0) {
	throw new Error('Coverr API returned no popular videos; keeping the previous snapshot.');
}

const snapshot = {
	fetchedAt: new Date().toISOString(),
	total: firstPage.total ?? hits.length,
	pageSize,
	hits,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Saved ${snapshot.hits.length} Coverr recommendations.`);
