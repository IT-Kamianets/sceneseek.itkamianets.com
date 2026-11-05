import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const outputDirs = [path.join(rootDir, 'dist/app/browser')];

const staticRoutes = ['/'];

const company = await readJson('src/data/company/company.json');
const siteUrl = trimTrailingSlash(company.siteUrl || 'https://example.com');
const pageSeo = company.pageSeo ?? {};

const routes = staticRoutes.filter((route) => isIndexable(route, pageSeo));
const lastmod = new Date().toISOString().slice(0, 10);

await Promise.all(
	outputDirs.map(async (outputDir) => {
		await mkdir(outputDir, { recursive: true });
		await writeFile(path.join(outputDir, 'sitemap.xml'), buildSitemap(routes, siteUrl, lastmod));
		await writeFile(path.join(outputDir, 'robots.txt'), buildRobots(siteUrl));
	}),
);

function buildSitemap(routes, siteUrl, lastmod) {
	const urls = routes
		.map(
			(route) => `	<url>
		<loc>${escapeXml(toAbsoluteUrl(siteUrl, route))}</loc>
		<lastmod>${lastmod}</lastmod>
	</url>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobots(siteUrl) {
	return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function isIndexable(route, pageSeo) {
	const robots = pageSeo[route]?.robots;

	return typeof robots !== 'string' || !robots.toLowerCase().includes('noindex');
}

async function readJson(relativePath) {
	return JSON.parse(await readFile(path.join(rootDir, relativePath), 'utf8'));
}

function toAbsoluteUrl(siteUrl, route) {
	return `${siteUrl}${route === '/' ? '' : route}`;
}

function trimTrailingSlash(value) {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function escapeXml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
