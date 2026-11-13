import { PLATFORM_ID, Service, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SavedScene } from '../saved-scenes/saved-scenes.service';

interface ApiMetadata {
	value?: string;
}

interface CommonsImageInfo {
	url?: string;
	descriptionurl?: string;
	thumburl?: string;
	mime?: string;
	width?: number;
	height?: number;
	user?: string;
	extmetadata?: Record<string, ApiMetadata>;
}

interface CommonsPage {
	pageid: number;
	title: string;
	imageinfo?: CommonsImageInfo[];
	videoinfo?: Array<{
		url?: string;
		mime?: string;
		size?: { width?: number; height?: number; duration?: number };
		derivatives?: Array<{ src?: string; type?: string; width?: number }>;
	}>;
}

interface CommonsResponse {
	query?: { pages?: CommonsPage[] };
	error?: { info?: string };
}

export interface CommonsVideo extends SavedScene {
	provider: 'Wikimedia Commons';
	thumbnailUrl?: string;
	videoUrl?: string;
	videoMimeType?: string;
	sourcePageUrl: string;
	authorName: string;
	licenseName: string;
	licenseUrl?: string;
}

function cleanMetadata(value?: string): string {
	return (value ?? '')
		.replace(/<[^>]*>/gu, ' ')
		.replace(/&nbsp;/gu, ' ')
		.replace(/&amp;/gu, '&')
		.replace(/&quot;/gu, '"')
		.replace(/&#39;|&apos;/gu, "'")
		.replace(/&lt;/gu, '<')
		.replace(/&gt;/gu, '>')
		.replace(/\s+/gu, ' ')
		.trim();
}

function readDuration(value?: string): number {
	const text = cleanMetadata(value);
	const clock = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.\d+)?$/u);
	if (clock) {
		return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
	}
	const units = text.match(
		/(?:(\d+)\s*(?:h|hr|hour|год))?\s*(?:(\d+)\s*(?:m|min|minute|хв))?\s*(?:(\d+)\s*(?:s|sec|second|с))?/iu,
	);
	if (units && units.slice(1).some(Boolean)) {
		return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
	}
	return 0;
}

function resolutionQuality(width: number, height: number): SavedScene['quality'] {
	const largestDimension = Math.max(width, height);
	return largestDimension >= 3840
		? '4k'
		: largestDimension >= 1920
			? '1080p'
			: largestDimension >= 1280
				? '720p'
				: '480p';
}

@Service()
export class WikimediaCommonsService {
	private readonly _platformId = inject(PLATFORM_ID);

	async searchVideos(query: string): Promise<CommonsVideo[]> {
		if (!isPlatformBrowser(this._platformId)) {
			return [];
		}
		const cleanQuery = query.trim();
		if (!cleanQuery) {
			return [];
		}

		const searchParams = new URLSearchParams({
			action: 'query',
			generator: 'search',
			gsrsearch: `filetype:video ${cleanQuery}`,
			gsrnamespace: '6',
			gsrlimit: '12',
			prop: 'imageinfo',
			iiprop: 'url|size|mime|extmetadata|user',
			iiurlwidth: '720',
			iiextmetadatalanguage: 'uk',
			iiextmetadatafilter:
				'Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription|Length',
			format: 'json',
			formatversion: '2',
			origin: '*',
		});
		const searchResponse = await this._request(searchParams);
		const pages = (searchResponse.query?.pages ?? []).filter(
			(page) => page.imageinfo?.[0]?.url,
		);
		if (!pages.length) {
			return [];
		}

		const videoParams = new URLSearchParams({
			action: 'query',
			titles: pages.map((page) => page.title).join('|'),
			prop: 'videoinfo',
			viprop: 'derivatives|url|mime|size',
			format: 'json',
			formatversion: '2',
			origin: '*',
		});
		const videoResponse = await this._request(videoParams);
		const videoInfoByTitle = new Map(
			(videoResponse.query?.pages ?? []).map((page) => [page.title, page.videoinfo?.[0]]),
		);

		return pages.flatMap((page) => {
			const image = page.imageinfo?.[0];
			if (!image?.url) {
				return [];
			}
			const info = videoInfoByTitle.get(page.title);
			const playable = info?.derivatives
				?.filter((file) =>
					['video/webm', 'video/mp4', 'video/ogg'].some((mime) =>
						(file.type ?? '').startsWith(mime),
					),
				)
				.sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0];
			const videoUrl = playable?.src ?? info?.url ?? image.url;
			const videoMimeType = playable?.type ?? info?.mime ?? image.mime ?? 'video/webm';
			const width = info?.size?.width ?? image.width ?? 0;
			const height = info?.size?.height ?? image.height ?? 0;
			const metadata = image.extmetadata ?? {};
			const artist = cleanMetadata(metadata['Artist']?.value);
			const credit = cleanMetadata(metadata['Credit']?.value);
			const authorName =
				artist || credit || image.user || 'Автор зазначений на сторінці файлу';
			const description = cleanMetadata(metadata['ImageDescription']?.value);
			const title =
				cleanMetadata(page.title.replace(/^File:/u, '').replace(/_/gu, ' ')).replace(
					/\.[^.]+$/u,
					'',
				) || 'Відеосцена Wikimedia Commons';
			const duration = Math.round(
				info?.size?.duration ?? readDuration(metadata['Length']?.value),
			);

			return [
				{
					id: `commons-${page.pageid}`,
					title,
					tags: [],
					duration,
					durationLabel: duration
						? `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`
						: '—',
					orientation: width >= height ? ('landscape' as const) : ('portrait' as const),
					quality: resolutionQuality(width, height),
					searchText: `${title} ${description}`,
					scene: 'forest' as const,
					provider: 'Wikimedia Commons' as const,
					thumbnailUrl: image.thumburl,
					videoUrl,
					videoMimeType,
					sourcePageUrl:
						image.descriptionurl ??
						`https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /gu, '_'))}`,
					authorName,
					licenseName:
						cleanMetadata(metadata['LicenseShortName']?.value) ||
						'Ліцензія на сторінці джерела',
					...(cleanMetadata(metadata['LicenseUrl']?.value)
						? { licenseUrl: cleanMetadata(metadata['LicenseUrl']?.value) }
						: {}),
				},
			];
		});
	}

	private async _request(params: URLSearchParams): Promise<CommonsResponse> {
		const response = await fetch(
			`https://commons.wikimedia.org/w/api.php?${params.toString()}`,
			{
				headers: { Accept: 'application/json' },
			},
		);
		if (!response.ok) {
			throw new Error(`Wikimedia Commons API returned ${response.status}`);
		}
		const data = (await response.json()) as CommonsResponse;
		if (data.error) {
			throw new Error(data.error.info || 'Wikimedia Commons search failed');
		}
		return data;
	}
}
