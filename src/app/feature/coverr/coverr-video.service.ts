import { PLATFORM_ID, Service, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SavedScene } from '../saved-scenes/saved-scenes.service';
import { environment } from '../../../environments/environment';

interface CoverrUrls {
	mp4?: string;
	mp4_preview?: string;
	mp4_download?: string;
}

interface CoverrCreator {
	name?: string;
	url?: string;
}

interface CoverrVideoRecord {
	id: string;
	title?: string;
	description?: string;
	thumbnail?: string;
	poster?: string;
	duration?: number;
	max_width?: number;
	max_height?: number;
	is_vertical?: boolean;
	aspect_ratio?: string;
	tags?: string[];
	urls?: CoverrUrls;
	url?: string;
	page_url?: string;
	web_url?: string;
	creator?: CoverrCreator | string;
	author?: CoverrCreator | string;
	photographer?: CoverrCreator | string;
}

interface CoverrSearchResponse {
	hits?: CoverrVideoRecord[];
	error?: string;
	page?: number;
	pages?: number;
	total?: number;
}

export interface CoverrVideo extends SavedScene {
	provider: 'Coverr';
	providerUrl: 'https://coverr.co';
	thumbnailUrl?: string;
	videoUrl: string;
	videoMimeType: 'video/mp4';
	sourcePageUrl: string;
	authorName: string;
	authorUrl?: string;
	licenseName: 'Coverr License';
	licenseUrl: 'https://coverr.co/license';
}

function creatorName(video: CoverrVideoRecord): string {
	for (const creator of [video.creator, video.author, video.photographer]) {
		if (typeof creator === 'string' && creator.trim()) {
			return creator.trim();
		}
		if (creator && typeof creator === 'object' && creator.name?.trim()) {
			return creator.name.trim();
		}
	}
	return 'Creator not provided by the API';
}

function creatorUrl(video: CoverrVideoRecord): string | undefined {
	for (const creator of [video.creator, video.author, video.photographer]) {
		if (creator && typeof creator === 'object' && creator.url?.trim()) {
			return creator.url.trim();
		}
	}
	return undefined;
}

function qualityFor(width: number, height: number): SavedScene['quality'] {
	const largestDimension = Math.max(width, height);
	return largestDimension >= 3840
		? '4k'
		: largestDimension >= 1920
			? '1080p'
			: largestDimension >= 1280
				? '720p'
				: '480p';
}

export interface VideoPlaybackVariant {
	key: 'max' | 'preview';
	label: string;
	url: string;
}

export function videoPlaybackVariants(scene: SavedScene): VideoPlaybackVariant[] {
	let maxUrl = scene.videoUrl;
	let previewUrl = scene.videoPreviewUrl;
	let previewQuality = scene.videoPreviewQuality;

	// Older saved Coverr scenes stored only the 360p preview URL.
	if (!previewUrl && scene.provider === 'Coverr' && maxUrl) {
		const match = maxUrl.match(/\/(\d{3,4})p\.mp4(?=[?#]|$)/iu);
		if (match?.[1] === '360') {
			previewUrl = maxUrl;
			previewQuality = '360p';
			const targetResolution = scene.quality === '4k' ? '2160p' : scene.quality;
			maxUrl = maxUrl.replace(/\/\d{3,4}p\.mp4(?=[?#]|$)/iu, `/${targetResolution}.mp4`);
		}
	}

	if (!maxUrl) {
		return [];
	}

	const maxQuality = scene.quality === '4k' ? '4K' : scene.quality;
	const variants: VideoPlaybackVariant[] = [
		{ key: 'max', label: `${maxQuality} · maximum`, url: maxUrl },
	];
	if (previewUrl && previewUrl !== maxUrl) {
		const inferredPreviewQuality = previewUrl.match(/\/(\d{3,4}p)\.mp4(?=[?#]|$)/iu)?.[1];
		variants.push({
			key: 'preview',
			label: `${previewQuality ?? inferredPreviewQuality ?? 'Preview'} · faster loading`,
			url: previewUrl,
		});
	}
	return variants;
}

@Service()
export class CoverrVideoService {
	private readonly _platformId = inject(PLATFORM_ID);

	async search(query: string): Promise<CoverrVideo[]> {
		const cleanQuery = query.trim();
		if (!cleanQuery) {
			return [];
		}

		return this._fetchVideos(
			new URLSearchParams({
				[environment.production ? 'q' : 'query']: cleanQuery,
				page_size: '12',
				urls: 'true',
			}),
		);
	}

	async popularVideos(): Promise<CoverrVideo[]> {
		if (environment.production) {
			return this._fetchRecommendationsSnapshot();
		}

		return this._fetchVideos(
			new URLSearchParams({
				sort: 'popular',
				page_size: '12',
				urls: 'true',
			}),
		);
	}

	private async _fetchRecommendationsSnapshot(): Promise<CoverrVideo[]> {
		const response = await fetch('/data/coverr-popular.json', {
			headers: { Accept: 'application/json' },
		});
		if (!response.ok) {
			throw new Error(`Could not load recommendations (${response.status}).`);
		}
		const data = (await response.json()) as CoverrSearchResponse;
		return this._mapVideos(data);
	}

	private async _fetchVideos(params: URLSearchParams): Promise<CoverrVideo[]> {
		if (!isPlatformBrowser(this._platformId)) {
			return [];
		}
		const requestUrl = environment.production
			? `${environment.coverrApiUrl}?${params.toString()}`
			: `/coverr-api/videos?${params.toString()}`;
		const response = await fetch(requestUrl, {
			headers: { Accept: 'application/json' },
		});
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				throw new Error('Coverr has no local API key or access.');
			}
			throw new Error(`Coverr API returned an error ${response.status}.`);
		}
		const data = (await response.json()) as CoverrSearchResponse;
		if (data.error) {
			throw new Error(data.error);
		}

		return this._mapVideos(data);
	}

	private _mapVideos(data: CoverrSearchResponse): CoverrVideo[] {
		return (data.hits ?? []).flatMap((video) => {
			const videoUrl = video.urls?.mp4 || video.urls?.mp4_download || video.urls?.mp4_preview;
			if (!video.id || !videoUrl) {
				return [];
			}
			const videoPreviewUrl = video.urls?.mp4_preview;
			const videoPreviewQuality = videoPreviewUrl?.match(/\/(\d{3,4}p)\.mp4(?=[?#]|$)/iu)?.[1];
			const title = video.title?.trim() || 'Coverr video clip';
			const duration = Math.max(0, Math.round(video.duration ?? 0));
			const width = video.max_width ?? 0;
			const height = video.max_height ?? 0;
			const sourcePageUrl = video.page_url || video.web_url || video.url || 'https://coverr.co/videos';
			const rawTags = video.tags ?? [];

			return [
				{
					id: `coverr-${video.id}`,
					title,
					tags: rawTags,
					duration,
					durationLabel: duration
						? `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`
						: '—',
					orientation:
						video.is_vertical || (height > width && width > 0) ? 'portrait' : 'landscape',
					quality: qualityFor(width, height),
					searchText: `${title} ${video.description ?? ''} ${rawTags.join(' ')}`,
					scene: 'forest' as const,
					provider: 'Coverr' as const,
					providerUrl: 'https://coverr.co' as const,
					thumbnailUrl: video.thumbnail || video.poster,
					videoUrl,
					...(videoPreviewUrl && videoPreviewUrl !== videoUrl
						? {
							videoPreviewUrl,
							...(videoPreviewQuality ? { videoPreviewQuality } : {}),
						}
						: {}),
					videoMimeType: 'video/mp4' as const,
					sourcePageUrl,
					authorName: creatorName(video),
					authorUrl: creatorUrl(video),
					licenseName: 'Coverr License' as const,
					licenseUrl: 'https://coverr.co/license' as const,
				},
			];
		});
}
}
