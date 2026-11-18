import {
	Component,
	DestroyRef,
	ElementRef,
	PLATFORM_ID,
	ViewChild,
	computed,
	inject,
	signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import {
	SearchHistoryCategory,
	SearchHistoryDraft,
	SearchHistoryEntry,
	SearchHistoryDuration,
	SearchHistoryInputMethod,
	SearchHistoryOrientation,
	SearchHistoryQuality,
	SearchHistoryService,
	SearchHistorySortOrder,
} from '../../feature/search-history/search-history.service';
import { SavedScene, SavedScenesService } from '../../feature/saved-scenes/saved-scenes.service';
import {
	CoverrVideoService,
	videoPlaybackVariants,
	type CoverrVideo,
	type VideoPlaybackVariant,
} from '../../feature/coverr/coverr-video.service';
import {
	WikimediaCommonsService,
} from '../../feature/wikimedia-commons/wikimedia-commons.service';

type CategoryId = SearchHistoryCategory;
type RecommendationTag = Exclude<CategoryId, 'for-you'>;
type SortOrder = SearchHistorySortOrder;
type DurationFilter = SearchHistoryDuration;
type OrientationFilter = SearchHistoryOrientation;
type QualityFilter = SearchHistoryQuality;

function readSearchParam<T extends string>(
	route: ActivatedRoute,
	key: string,
	allowed: readonly T[],
	fallback: T,
): T {
	const value = route.snapshot.queryParamMap.get(key);
	return allowed.find((item) => item === value) ?? fallback;
}

interface SpeechRecognitionLike {
	lang: string;
	interimResults: boolean;
	maxAlternatives: number;
	onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
	if (typeof window === 'undefined') {
		return undefined;
	}

	const browser = window as Window & {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	};

	return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function searchStem(value: string): string {
	return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en');
}

function matchesSearchWord(word: string, term: string): boolean {
	return word.startsWith(term) || term.startsWith(word);
}

const SEARCH_STOP_WORDS = new Set([
	'over',
	'after',
	'before',
	'through',
	'for',
	'or',
	'but',
	'which',
	'the',
	'a',
	'an',
	'on',
	'in',
	'at',
	'with',
	'from',
	'to',
]);

interface HomeCategory {
	id: CategoryId;
	label: string;
}

interface Recommendation extends SavedScene {
	tags: RecommendationTag[];
}

const RECOMMENDATION_TAGS: Record<RecommendationTag, string[]> = {
	atmosphere: [
		'atmosphere',
		'fog',
		'mist',
		'sunset',
		'sunrise',
		'rain',
		'cloud',
		'light',
		'mood',
	],
	cinematic: ['cinematic', 'film', 'movie', 'dramatic', 'slow motion', 'bokeh', 'lens'],
	nature: [
		'nature',
		'forest',
		'tree',
		'lake',
		'ocean',
		'sea',
		'water',
		'mountain',
		'wildlife',
		'flower',
		'landscape',
		'beach',
	],
	city: ['city', 'urban', 'street', 'building', 'architecture', 'traffic', 'road', 'subway'],
};

const HOME_CATEGORIES: HomeCategory[] = [
	{ id: 'for-you', label: 'For you' },
	{ id: 'atmosphere', label: 'Atmosphere' },
	{ id: 'cinematic', label: 'Cinematic' },
	{ id: 'nature', label: 'Nature' },
	{ id: 'city', label: 'City scenes' },
];

const HOME_RECOMMENDATIONS: Recommendation[] = [
	{
		id: 'mountains',
		title: 'Sunrise over a mountain lake',
		tags: ['atmosphere', 'cinematic', 'nature'],
		duration: 18,
		durationLabel: '00:18',
		orientation: 'landscape',
		quality: '4k',
		searchText: 'sunrise mountain lake fog water nature morning',
		scene: 'mountains',
	},
	{
		id: 'city',
		title: 'City streets after rain',
		tags: ['atmosphere', 'cinematic', 'city'],
		duration: 12,
		durationLabel: '00:12',
		orientation: 'portrait',
		quality: '1080p',
		searchText: 'city street rain evening neon traffic urban',
		scene: 'city',
	},
	{
		id: 'coast',
		title: 'Waves on a quiet coast',
		tags: ['atmosphere', 'nature'],
		duration: 24,
		durationLabel: '00:24',
		orientation: 'landscape',
		quality: '1080p',
		searchText: 'waves sea coast shore water nature calm',
		scene: 'coast',
	},
	{
		id: 'forest',
		title: 'Sunlight streaming through a forest',
		tags: ['atmosphere', 'cinematic', 'nature'],
		duration: 36,
		durationLabel: '00:36',
		orientation: 'landscape',
		quality: '4k',
		searchText: 'sunlight forest trees fog nature light',
		scene: 'forest',
	},
	{
		id: 'night',
		title: 'Neon rhythm of the city at night',
		tags: ['cinematic', 'city'],
		duration: 31,
		durationLabel: '00:31',
		orientation: 'portrait',
		quality: '720p',
		searchText: 'neon night city streets rain urban',
		scene: 'night',
	},
	{
		id: 'desert',
		title: 'Golden dunes before sunset',
		tags: ['cinematic', 'nature'],
		duration: 9,
		durationLabel: '00:09',
		orientation: 'landscape',
		quality: '720p',
		searchText: 'golden dunes desert sand sunset nature',
		scene: 'desert',
	},
];

@Component({
	selector: 'app-landing',
	imports: [RouterLink, TranslateDirective],
	templateUrl: './landing.component.html',
	styleUrl: './landing.component.scss',
})
export class LandingComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _language = inject(LanguageService);
	private readonly _translate = inject(TranslateService);
	private readonly _platformId = inject(PLATFORM_ID);
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly searchHistory = inject(SearchHistoryService);
	protected readonly pageMode = this._route.snapshot.data['pageMode'] as 'explore' | 'search';
	protected readonly categories = HOME_CATEGORIES;
	protected readonly activeCategory = signal<CategoryId>(
		readSearchParam(
			this._route,
			'category',
			['for-you', 'atmosphere', 'cinematic', 'nature', 'city'],
			'for-you',
		),
	);
	protected readonly query = signal(this._route.snapshot.queryParamMap.get('q') ?? '');
	protected readonly submittedQuery = signal(this._route.snapshot.queryParamMap.get('q') ?? '');
	protected readonly selectedPhotoName = signal('');
	protected readonly searchMessage = signal('');
	protected readonly searchError = signal(false);
	protected readonly sortOrder = signal<SortOrder>(
		readSearchParam(this._route, 'sort', ['relevance', 'shortest', 'longest'], 'relevance'),
	);
	protected readonly durationFilter = signal<DurationFilter>(
		readSearchParam(this._route, 'duration', ['any', 'under-15', '15-30', 'over-30'], 'any'),
	);
	protected readonly orientationFilter = signal<OrientationFilter>(
		readSearchParam(this._route, 'orientation', ['any', 'landscape', 'portrait'], 'any'),
	);
	protected readonly qualityFilter = signal<QualityFilter>(
		readSearchParam(this._route, 'quality', ['any', '720p', '1080p', '4k'], 'any'),
	);
	private readonly _lastInputMethod = signal<SearchHistoryInputMethod>(
		readSearchParam(this._route, 'inputMethod', ['text', 'voice'], 'text'),
	);
	protected readonly voiceSupported = signal(
		isPlatformBrowser(inject(PLATFORM_ID)) && !!getSpeechRecognitionConstructor(),
	);
	protected readonly isListening = signal(false);
	protected readonly previewScene = signal<Recommendation | null>(null);
	protected readonly playbackQuality = signal<VideoPlaybackVariant['key']>('max');
	protected readonly commonsLoading = signal(false);
	protected readonly commonsError = signal('');
	protected readonly providerNotice = signal('');
	private readonly _commonsVideos = signal<Recommendation[]>([]);
	protected readonly recommendationsLoading = signal(false);
	private readonly _coverrRecommendations = signal<Recommendation[]>([]);
	protected readonly currentPage = signal(1);
	protected readonly pageSize = 12;
	protected readonly pageCount = computed(() =>
		Math.max(1, Math.ceil(this.recommendations().length / this.pageSize)),
	);
	protected readonly pageNumbers = computed(() =>
		Array.from({ length: this.pageCount() }, (_, index) => index + 1),
	);
	protected readonly recentSearches = computed(() => {
		const seen = new Set<string>();
		return this.searchHistory.entries().filter((entry) => {
			const normalizedQuery = entry.query.trim().toLocaleLowerCase('en');
			if (!normalizedQuery || seen.has(normalizedQuery)) {
				return false;
			}
			seen.add(normalizedQuery);
			return true;
		}).slice(0, 5);
	});
	protected readonly visibleRecommendations = computed(() => {
		const start = (this.currentPage() - 1) * this.pageSize;
		return this.recommendations().slice(start, start + this.pageSize);
	});
	protected readonly recommendationCountLabel = computed(() => {
		const count = this.recommendations().length;
		const template = this.translateText(count === 1 ? '{{count}} scene' : '{{count}} scenes');
		return this._translate.interpolate(template, { count });
	});
	protected translateText(text: string): string {
		return this._translate.translate(text)();
	}
	protected displayTitle(item: Recommendation): string {
		return item.provider ? item.title : this.translateText(item.title);
	}
	protected pageAriaLabel(page: number): string {
		return this._translate.interpolate(this.translateText('Page {{page}}'), { page });
	}
	private readonly _authPrompt = inject(AuthPromptService);
	private readonly _coverr = inject(CoverrVideoService);
	private readonly _wikimediaCommons = inject(WikimediaCommonsService);
	protected readonly savedScenes = inject(SavedScenesService);
	private readonly _destroyRef = inject(DestroyRef);
	private _recognition: SpeechRecognitionLike | null = null;
	private _searchRequest = 0;
	@ViewChild('previewDialog') private _previewDialog?: ElementRef<HTMLDialogElement>;
	@ViewChild('photoInput') private _photoInput?: ElementRef<HTMLInputElement>;

	constructor() {
		if (this.submittedQuery().trim()) {
			this._recordSearch('text');
			void this._loadVideos(this.submittedQuery());
		} else if (this.pageMode === 'explore') {
			void this._loadRecommendations();
		}
		if (this.pageMode === 'search') {
			void this.searchHistory.load().catch(() => undefined);
		}
		this._destroyRef.onDestroy(() => {
			if (this._recognition) {
				this._recognition.onend = null;
				this._recognition.abort();
			}
		});
		void this.savedScenes.load().catch(() => undefined);
	}
	protected readonly recommendations = computed(() => {
		const category = this.activeCategory();
		const terms = this.submittedQuery()
			.split(/[^\p{L}\p{N}]+/u)
			.map((term) => term.toLocaleLowerCase('en'))
			.filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term))
			.map(searchStem);
		const durationFilter = this.durationFilter();
		const orientationFilter = this.orientationFilter();
		const qualityFilter = this.qualityFilter();

		const source =
			this.pageMode === 'search'
				? this._commonsVideos()
				: this._coverrRecommendations().length
					? this._coverrRecommendations()
					: HOME_RECOMMENDATIONS;
		let matches = source.filter(
			(item) => category === 'for-you' || item.tags.includes(category),
		);

		if (terms.length && this.pageMode !== 'search') {
			matches = matches.filter((item) => {
				const searchableText = `${item.title} ${item.searchText}`
					.split(/[^\p{L}\p{N}]+/u)
					.map(searchStem);
				return terms.every((term) =>
					searchableText.some((word) => matchesSearchWord(word, term)),
				);
			});
		}

		if (durationFilter === 'under-15') {
			matches = matches.filter((item) => item.duration > 0 && item.duration < 15);
		} else if (durationFilter === '15-30') {
			matches = matches.filter((item) => item.duration >= 15 && item.duration <= 30);
		} else if (durationFilter === 'over-30') {
			matches = matches.filter((item) => item.duration > 30);
		}

		if (orientationFilter !== 'any') {
			matches = matches.filter((item) => item.orientation === orientationFilter);
		}

		if (qualityFilter !== 'any') {
			const minimumQuality =
				qualityFilter === '4k' ? 2160 : Number.parseInt(qualityFilter, 10);
			matches = matches.filter(
				(item) =>
					(item.quality === '4k' ? 2160 : Number.parseInt(item.quality, 10)) >=
					minimumQuality,
			);
		}

		if (this.sortOrder() === 'relevance' && terms.length && this.pageMode !== 'search') {
			const score = (item: Recommendation) => {
				const searchableText = `${item.title} ${item.searchText}`
					.split(/[^\p{L}\p{N}]+/u)
					.map(searchStem);
				return terms.reduce(
					(total, term) =>
						total +
						searchableText.filter((word) => matchesSearchWord(word, term)).length,
					0,
				);
			};
			matches = [...matches].sort((left, right) => score(right) - score(left));
		} else if (this.sortOrder() === 'shortest') {
			matches = [...matches].sort(
				(left, right) =>
					(left.duration || Number.POSITIVE_INFINITY) -
					(right.duration || Number.POSITIVE_INFINITY),
			);
		} else if (this.sortOrder() === 'longest') {
			matches = [...matches].sort(
				(left, right) => (right.duration || 0) - (left.duration || 0),
			);
		}

		return matches;
	});

	protected onQueryChange(event: Event) {
		this.query.set((event.target as HTMLInputElement).value);
		this.searchMessage.set('');
		this.searchError.set(false);
	}

	protected onSearchSubmit(event: Event) {
		event.preventDefault();
		const query = this.query().trim();

		if (!query && !this.selectedPhotoName()) {
			this.searchError.set(true);
			this.searchMessage.set('Enter a scene description or add an image.');
			return;
		}

		if (!query && this.selectedPhotoName()) {
			this.submittedQuery.set('');
			this.searchError.set(false);
			this.searchMessage.set('Image search will be available soon.');
			return;
		}

		this._lastInputMethod.set('text');
		this.currentPage.set(1);
		this.submittedQuery.set(query);
		this.searchError.set(false);
		this.searchMessage.set(
			this.selectedPhotoName()
				? 'Your search uses text only; the image does not affect results yet.'
				: '',
		);
		this._recordSearch('text');
		void this._loadVideos(query);
	}

	protected setCategory(category: CategoryId) {
		this.currentPage.set(1);
		this.activeCategory.set(category);
		this._recordSearch(this._lastInputMethod());
	}

	protected setSortOrder(event: Event) {
		this.currentPage.set(1);
		this.sortOrder.set((event.target as HTMLSelectElement).value as SortOrder);
		this._recordSearch(this._lastInputMethod());
	}

	protected setDurationFilter(event: Event) {
		this.currentPage.set(1);
		this.durationFilter.set((event.target as HTMLSelectElement).value as DurationFilter);
		this._recordSearch(this._lastInputMethod());
	}

	protected setOrientationFilter(event: Event) {
		this.currentPage.set(1);
		this.orientationFilter.set((event.target as HTMLSelectElement).value as OrientationFilter);
		this._recordSearch(this._lastInputMethod());
	}

	protected setQualityFilter(event: Event) {
		this.currentPage.set(1);
		this.qualityFilter.set((event.target as HTMLSelectElement).value as QualityFilter);
		this._recordSearch(this._lastInputMethod());
	}

	private _recordSearch(inputMethod: SearchHistoryInputMethod) {
		const query = this.submittedQuery().trim();
		if (!query) {
			return;
		}

		const entry: SearchHistoryDraft = {
			query,
			durationFilter: this.durationFilter(),
			orientationFilter: this.orientationFilter(),
			qualityFilter: this.qualityFilter(),
			sortOrder: this.sortOrder(),
			category: this.activeCategory(),
			inputMethod,
			hasImage: Boolean(this.selectedPhotoName()),
		};
		void this.searchHistory.record(entry).catch(() => {
			this.searchError.set(false);
			this.searchMessage.set(this.searchHistory.message());
		});
	}

	protected applyRecentSearch(entry: SearchHistoryEntry) {
		this.query.set(entry.query);
		this.submittedQuery.set(entry.query);
		this.durationFilter.set(entry.durationFilter);
		this.orientationFilter.set(entry.orientationFilter);
		this.qualityFilter.set(entry.qualityFilter);
		this.sortOrder.set(entry.sortOrder);
		this.activeCategory.set(entry.category);
		this._lastInputMethod.set(entry.inputMethod);
		this.currentPage.set(1);
		this.searchMessage.set('');
		this.searchError.set(false);
		this._recordSearch(entry.inputMethod);
		void this._loadVideos(entry.query);
	}

	protected onVoiceSearch() {
		if (this.isListening()) {
			this._recognition?.stop();
			return;
		}

		const SpeechRecognition = getSpeechRecognitionConstructor();
		if (!SpeechRecognition) {
			this.searchError.set(true);
			this.searchMessage.set('Voice search is unavailable in this browser.');
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.lang = this._language.language() === 'ua' ? 'uk-UA' : 'en-US';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onresult = (event) => {
			const transcript = event.results[0]?.[0]?.transcript.trim();
			if (!transcript) {
				return;
			}

			this.query.set(transcript);
			this.currentPage.set(1);
			this.submittedQuery.set(transcript);
			this._lastInputMethod.set('voice');
			this.searchMessage.set('');
			this.searchError.set(false);
			this._recordSearch('voice');
			void this._loadVideos(transcript);
		};
		recognition.onerror = (event) => {
			if (event.error === 'aborted') {
				return;
			}

			this.searchError.set(true);
			this.searchMessage.set(
				event.error === 'not-allowed'
					? 'Allow microphone access to use voice search.'
					: 'Could not recognize your search. Please try again.',
			);
		};
		recognition.onend = () => {
			this.isListening.set(false);
			if (this.searchMessage() === 'Listening to your search…') {
				this.searchMessage.set('Recording stopped without a recognized search.');
			}
			if (this._recognition === recognition) {
				this._recognition = null;
			}
		};

		this._recognition = recognition;
		this.isListening.set(true);
		this.searchError.set(false);
		this.searchMessage.set('Listening to your search…');
		try {
			recognition.start();
		} catch {
			this.isListening.set(false);
			this._recognition = null;
			this.searchError.set(true);
			this.searchMessage.set('Could not start the microphone. Please try again.');
		}
	}

	private async _loadVideos(query: string) {
		this.currentPage.set(1);
		const request = ++this._searchRequest;
		this._commonsVideos.set([]);
		this.commonsError.set('');
		this.providerNotice.set('');
		this.commonsLoading.set(true);
		const [coverrResult, commonsResult] = await Promise.allSettled([
			this._coverr.search(query),
			this._wikimediaCommons.searchVideos(query),
		]);
		if (request !== this._searchRequest) {
			return;
		}

		const videos: SavedScene[] = [];
		if (coverrResult.status === 'fulfilled') {
			videos.push(...coverrResult.value);
		}
		if (commonsResult.status === 'fulfilled') {
			videos.push(...commonsResult.value);
		}
		this._commonsVideos.set(videos.map((video) => this._toRecommendation(video)));

		if (coverrResult.status === 'rejected' && commonsResult.status === 'fulfilled') {
			this.providerNotice.set(
				'Coverr is temporarily unavailable. Showing videos from Wikimedia Commons.',
			);
		} else if (commonsResult.status === 'rejected' && coverrResult.status === 'fulfilled') {
			this.providerNotice.set('Wikimedia Commons is temporarily unavailable. Showing Coverr results.');
		} else if (coverrResult.status === 'rejected' && commonsResult.status === 'rejected') {
			this.commonsError.set(
				'Could not load videos. Check your connection and local Coverr API key, then try again.',
			);
		}
		this.commonsLoading.set(false);
	}

	private _toRecommendation(video: SavedScene): Recommendation {
		return {
			...video,
			tags: [],
			searchText: `${video.title} ${video.searchText}`,
		};
	}

	private async _loadRecommendations() {
		if (!isPlatformBrowser(this._platformId)) {
			return;
		}
		this.currentPage.set(1);
		this.providerNotice.set('');
		this.recommendationsLoading.set(true);
		try {
			const videos = await this._coverr.popularVideos();
			if (videos.length) {
				this._coverrRecommendations.set(videos.map((video) => this._toCoverrRecommendation(video)));
			} else {
				this._coverrRecommendations.set([]);
				this.providerNotice.set('Could not load recommendations from Coverr. Showing sample scenes instead.');
			}
		} catch {
			this._coverrRecommendations.set([]);
			this.providerNotice.set('Coverr is unavailable. Showing sample scenes instead.');
		} finally {
			this.recommendationsLoading.set(false);
		}
	}

	private _toCoverrRecommendation(video: CoverrVideo): Recommendation {
		const searchableText = `${video.title} ${video.searchText}`.toLocaleLowerCase('en');
		const tags = (Object.keys(RECOMMENDATION_TAGS) as RecommendationTag[]).filter((category) =>
			RECOMMENDATION_TAGS[category].some((keyword) => searchableText.includes(keyword)),
		);
		const scene: Recommendation['scene'] = tags.includes('city')
			? 'city'
			: tags.includes('nature')
				? 'forest'
				: tags.includes('cinematic')
					? 'night'
					: 'coast';

		return { ...video, tags, scene };
	}

	protected retryCommonsSearch() {
		void this._loadVideos(this.submittedQuery());
	}

	protected openPreview(item: Recommendation) {
		this.previewScene.set(item);
		this.playbackQuality.set('max');
		this._previewDialog?.nativeElement.showModal();
		void this.searchHistory.recordViewed(item);
	}

	protected videoVariants(item: Recommendation) {
		return videoPlaybackVariants(item);
	}

	protected selectedVideoUrl(item: Recommendation) {
		const variants = this.videoVariants(item);
		return variants.find((variant) => variant.key === this.playbackQuality())?.url ?? item.videoUrl;
	}

	protected setPlaybackQuality(event: Event) {
		this.playbackQuality.set(
			(event.target as HTMLSelectElement).value === 'preview' ? 'preview' : 'max',
		);
	}

	protected onRecommendationKeydown(event: KeyboardEvent, item: Recommendation) {
		if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
			return;
		}
		event.preventDefault();
		this.openPreview(item);
	}

	protected closePreview() {
		this._previewDialog?.nativeElement.close();
		this.previewScene.set(null);
	}

	protected onPreviewDialogClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			this.closePreview();
		}
	}

	protected onPreviewDialogClose() {
		this.previewScene.set(null);
	}

	protected onPhotoSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			this.searchError.set(true);
			this.searchMessage.set('Choose an image file.');
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			this.searchError.set(true);
			this.searchMessage.set('Image must be smaller than 10 MB.');
			input.value = '';
			return;
		}

		this.selectedPhotoName.set(file.name);
		this.searchMessage.set('');
		this.searchError.set(false);
	}

	protected removePhoto(input: HTMLInputElement) {
		input.value = '';
		this.selectedPhotoName.set('');
	}

	protected resetSearch() {
		this.currentPage.set(1);
		this.query.set('');
		this.submittedQuery.set('');
		this.selectedPhotoName.set('');
		this.searchMessage.set('');
		this.searchError.set(false);
		this.activeCategory.set('for-you');
		this.durationFilter.set('any');
		this.orientationFilter.set('any');
		this.qualityFilter.set('any');
		this.sortOrder.set('relevance');
		if (this._photoInput) {
			this._photoInput.nativeElement.value = '';
		}
	}

	protected goToPage(page: number) {
		this.currentPage.set(Math.min(Math.max(page, 1), this.pageCount()));
	}

	protected async toggleSavedScene(item: Recommendation) {
		await this.auth.waitUntilReady();
		if (!this.auth.user()) {
			this._authPrompt.open('saved');
			return;
		}
		try {
			await this.savedScenes.toggle(item);
		} catch {
			// The service exposes a localized message for Firebase setup or permission errors.
		}
	}
}
