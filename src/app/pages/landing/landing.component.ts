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
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import {
	SearchHistoryCategory,
	SearchHistoryDraft,
	SearchHistoryDuration,
	SearchHistoryInputMethod,
	SearchHistoryOrientation,
	SearchHistoryQuality,
	SearchHistoryService,
	SearchHistorySortOrder,
} from '../../feature/search-history/search-history.service';
import { SavedScene, SavedScenesService } from '../../feature/saved-scenes/saved-scenes.service';
import {
	CommonsVideo,
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
	return value
		.toLocaleLowerCase('uk')
		.replace(
			/(ями|ами|ого|ому|ими|ій|ий|ою|ею|ах|ях|ів|їв|ам|ям|ом|ем|ку|ок|а|я|у|ю|і|и)$/u,
			'',
		);
}

function matchesSearchWord(word: string, term: string): boolean {
	return word.startsWith(term) || term.startsWith(word);
}

function sceneCountLabel(count: number): string {
	const lastDigit = count % 10;
	const lastTwoDigits = count % 100;
	const noun =
		lastDigit === 1 && lastTwoDigits !== 11
			? 'сцена'
			: lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
				? 'сцени'
				: 'сцен';
	return `${count} ${noun}`;
}

const SEARCH_STOP_WORDS = new Set([
	'над',
	'після',
	'перед',
	'крізь',
	'для',
	'або',
	'але',
	'який',
	'яка',
	'яке',
	'на',
	'у',
	'в',
	'з',
	'зі',
	'до',
]);

interface HomeCategory {
	id: CategoryId;
	label: string;
}

interface Recommendation extends SavedScene {
	tags: RecommendationTag[];
}

const HOME_CATEGORIES: HomeCategory[] = [
	{ id: 'for-you', label: 'Для вас' },
	{ id: 'atmosphere', label: 'Атмосфера' },
	{ id: 'cinematic', label: 'Кінематографічні' },
	{ id: 'nature', label: 'Природа' },
	{ id: 'city', label: 'Міські сцени' },
];

const HOME_RECOMMENDATIONS: Recommendation[] = [
	{
		id: 'mountains',
		title: 'Світанок над гірським озером',
		tags: ['atmosphere', 'cinematic', 'nature'],
		duration: 18,
		durationLabel: '00:18',
		orientation: 'landscape',
		quality: '4k',
		searchText: 'світанок світанку гори гірське озеро туман вода природа ранок',
		scene: 'mountains',
	},
	{
		id: 'city',
		title: 'Міські вулиці після дощу',
		tags: ['atmosphere', 'cinematic', 'city'],
		duration: 12,
		durationLabel: '00:12',
		orientation: 'portrait',
		quality: '1080p',
		searchText: 'місто вулиця дощ вечір неон транспорт урбаністика',
		scene: 'city',
	},
	{
		id: 'coast',
		title: 'Хвилі на тихому узбережжі',
		tags: ['atmosphere', 'nature'],
		duration: 24,
		durationLabel: '00:24',
		orientation: 'landscape',
		quality: '1080p',
		searchText: 'хвилі море узбережжя берег вода природа спокій',
		scene: 'coast',
	},
	{
		id: 'forest',
		title: 'Сонячне проміння крізь ліс',
		tags: ['atmosphere', 'cinematic', 'nature'],
		duration: 36,
		durationLabel: '00:36',
		orientation: 'landscape',
		quality: '4k',
		searchText: 'сонячне проміння ліс дерева туман природа світло',
		scene: 'forest',
	},
	{
		id: 'night',
		title: 'Неоновий ритм нічного міста',
		tags: ['cinematic', 'city'],
		duration: 31,
		durationLabel: '00:31',
		orientation: 'portrait',
		quality: '720p',
		searchText: 'неон нічне місто вулиці дощ урбаністика',
		scene: 'night',
	},
	{
		id: 'desert',
		title: 'Золоті дюни перед заходом сонця',
		tags: ['cinematic', 'nature'],
		duration: 9,
		durationLabel: '00:09',
		orientation: 'landscape',
		quality: '720p',
		searchText: 'золоті дюни пустеля пісок захід сонця природа',
		scene: 'desert',
	},
];

@Component({
	selector: 'app-landing',
	imports: [RouterLink],
	templateUrl: './landing.component.html',
	styleUrl: './landing.component.scss',
})
export class LandingComponent {
	private readonly _route = inject(ActivatedRoute);
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
	protected readonly commonsLoading = signal(false);
	protected readonly commonsError = signal('');
	private readonly _commonsVideos = signal<Recommendation[]>([]);
	protected readonly recommendationCountLabel = computed(() =>
		sceneCountLabel(this.recommendations().length),
	);
	private readonly _authPrompt = inject(AuthPromptService);
	private readonly _auth = inject(FirebaseAuthService);
	private readonly _searchHistory = inject(SearchHistoryService);
	private readonly _wikimediaCommons = inject(WikimediaCommonsService);
	protected readonly savedScenes = inject(SavedScenesService);
	private readonly _destroyRef = inject(DestroyRef);
	private _recognition: SpeechRecognitionLike | null = null;
	private _commonsRequest = 0;
	@ViewChild('previewDialog') private _previewDialog?: ElementRef<HTMLDialogElement>;
	@ViewChild('photoInput') private _photoInput?: ElementRef<HTMLInputElement>;

	constructor() {
		if (this.submittedQuery().trim()) {
			this._recordSearch('text');
			void this._loadCommonsVideos(this.submittedQuery());
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
			.map((term) => term.toLocaleLowerCase('uk'))
			.filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term))
			.map(searchStem);
		const durationFilter = this.durationFilter();
		const orientationFilter = this.orientationFilter();
		const qualityFilter = this.qualityFilter();

		const source = this.pageMode === 'search' ? this._commonsVideos() : HOME_RECOMMENDATIONS;
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
			this.searchMessage.set('Введіть опис сцени або додайте фото.');
			return;
		}

		if (!query && this.selectedPhotoName()) {
			this.submittedQuery.set('');
			this.searchError.set(false);
			this.searchMessage.set('Пошук за зображенням буде доступний пізніше.');
			return;
		}

		this._lastInputMethod.set('text');
		this.submittedQuery.set(query);
		this.searchError.set(false);
		this.searchMessage.set(
			this.selectedPhotoName()
				? 'Пошук виконується за текстом; фото поки не впливає на результати.'
				: '',
		);
		this._recordSearch('text');
		void this._loadCommonsVideos(query);
	}

	protected setCategory(category: CategoryId) {
		this.activeCategory.set(category);
		this._recordSearch(this._lastInputMethod());
	}

	protected setSortOrder(event: Event) {
		this.sortOrder.set((event.target as HTMLSelectElement).value as SortOrder);
		this._recordSearch(this._lastInputMethod());
	}

	protected setDurationFilter(event: Event) {
		this.durationFilter.set((event.target as HTMLSelectElement).value as DurationFilter);
		this._recordSearch(this._lastInputMethod());
	}

	protected setOrientationFilter(event: Event) {
		this.orientationFilter.set((event.target as HTMLSelectElement).value as OrientationFilter);
		this._recordSearch(this._lastInputMethod());
	}

	protected setQualityFilter(event: Event) {
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
		void this._searchHistory.record(entry).catch(() => {
			this.searchError.set(false);
			this.searchMessage.set(this._searchHistory.message());
		});
	}

	protected onVoiceSearch() {
		if (this.isListening()) {
			this._recognition?.stop();
			return;
		}

		const SpeechRecognition = getSpeechRecognitionConstructor();
		if (!SpeechRecognition) {
			this.searchError.set(true);
			this.searchMessage.set('Голосовий пошук недоступний у цьому браузері.');
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.lang = 'uk-UA';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onresult = (event) => {
			const transcript = event.results[0]?.[0]?.transcript.trim();
			if (!transcript) {
				return;
			}

			this.query.set(transcript);
			this.submittedQuery.set(transcript);
			this._lastInputMethod.set('voice');
			this.searchMessage.set('');
			this.searchError.set(false);
			this._recordSearch('voice');
			void this._loadCommonsVideos(transcript);
		};
		recognition.onerror = (event) => {
			if (event.error === 'aborted') {
				return;
			}

			this.searchError.set(true);
			this.searchMessage.set(
				event.error === 'not-allowed'
					? 'Дозвольте доступ до мікрофона, щоб скористатися голосовим пошуком.'
					: 'Не вдалося розпізнати запит. Спробуйте ще раз.',
			);
		};
		recognition.onend = () => {
			this.isListening.set(false);
			if (this.searchMessage() === 'Слухаю запит українською…') {
				this.searchMessage.set('Запис зупинено без розпізнаного запиту.');
			}
			if (this._recognition === recognition) {
				this._recognition = null;
			}
		};

		this._recognition = recognition;
		this.isListening.set(true);
		this.searchError.set(false);
		this.searchMessage.set('Слухаю запит українською…');
		try {
			recognition.start();
		} catch {
			this.isListening.set(false);
			this._recognition = null;
			this.searchError.set(true);
			this.searchMessage.set('Не вдалося запустити мікрофон. Спробуйте ще раз.');
		}
	}

	private async _loadCommonsVideos(query: string) {
		const request = ++this._commonsRequest;
		this._commonsVideos.set([]);
		this.commonsError.set('');
		this.commonsLoading.set(true);
		try {
			const videos = await this._wikimediaCommons.searchVideos(query);
			if (request === this._commonsRequest) {
				this._commonsVideos.set(videos.map((video) => this._toRecommendation(video)));
			}
		} catch {
			if (request === this._commonsRequest) {
				this.commonsError.set(
					'Не вдалося отримати відео з Wikimedia Commons. Перевірте з’єднання й спробуйте ще раз.',
				);
			}
		} finally {
			if (request === this._commonsRequest) {
				this.commonsLoading.set(false);
			}
		}
	}

	private _toRecommendation(video: CommonsVideo): Recommendation {
		return {
			...video,
			tags: [],
			searchText: `${video.title} ${video.searchText}`,
		};
	}

	protected retryCommonsSearch() {
		void this._loadCommonsVideos(this.submittedQuery());
	}

	protected openPreview(item: Recommendation) {
		this.previewScene.set(item);
		this._previewDialog?.nativeElement.showModal();
		void this._searchHistory.recordViewed(item);
	}

	protected categoryLabel(tag: RecommendationTag): string {
		const labels: Record<RecommendationTag, string> = {
			atmosphere: 'Атмосфера',
			cinematic: 'Кінематографічне',
			nature: 'Природа',
			city: 'Міська сцена',
		};
		return labels[tag];
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
			this.searchMessage.set('Оберіть файл зображення.');
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			this.searchError.set(true);
			this.searchMessage.set('Зображення має бути менше 10 МБ.');
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

	protected async toggleSavedScene(item: Recommendation) {
		await this._auth.waitUntilReady();
		if (!this._auth.user()) {
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
