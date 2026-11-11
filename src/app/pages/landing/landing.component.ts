import { Component, DestroyRef, ElementRef, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';

type CategoryId = 'for-you' | 'atmosphere' | 'cinematic' | 'nature' | 'city';
type RecommendationTag = Exclude<CategoryId, 'for-you'>;
type SortOrder = 'relevance' | 'shortest' | 'longest';
type DurationFilter = 'any' | 'under-15' | '15-30' | 'over-30';
type OrientationFilter = 'any' | 'landscape' | 'portrait';
type QualityFilter = 'any' | '720p' | '1080p' | '4k';

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
	return value.toLocaleLowerCase('uk').replace(/(ями|ами|ого|ому|ими|ій|ий|ою|ею|ах|ях|ів|їв|ам|ям|ом|ем|ку|ок|а|я|у|ю|і|и)$/u, '');
}

const SEARCH_STOP_WORDS = new Set(['над', 'після', 'перед', 'крізь', 'для', 'або', 'але', 'який', 'яка', 'яке', 'на', 'у', 'в', 'з', 'зі', 'до']);

interface HomeCategory {
	id: CategoryId;
	label: string;
}

interface Recommendation {
	id: string;
	title: string;
	tags: RecommendationTag[];
	duration: number;
	durationLabel: string;
	orientation: Exclude<OrientationFilter, 'any'>;
	quality: Exclude<QualityFilter, 'any'>;
	searchText: string;
	scene: 'mountains' | 'city' | 'coast' | 'forest' | 'night' | 'desert';
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
	templateUrl: './landing.component.html',
	styleUrl: './landing.component.scss',
})
export class LandingComponent {
	protected readonly categories = HOME_CATEGORIES;
	protected readonly activeCategory = signal<CategoryId>('for-you');
	protected readonly query = signal('');
	protected readonly submittedQuery = signal('');
	protected readonly selectedPhotoName = signal('');
	protected readonly searchMessage = signal('');
	protected readonly searchError = signal(false);
	protected readonly sortOrder = signal<SortOrder>('relevance');
	protected readonly durationFilter = signal<DurationFilter>('any');
	protected readonly orientationFilter = signal<OrientationFilter>('any');
	protected readonly qualityFilter = signal<QualityFilter>('any');
	protected readonly voiceSupported = signal(isPlatformBrowser(inject(PLATFORM_ID)) && !!getSpeechRecognitionConstructor());
	protected readonly isListening = signal(false);
	protected readonly previewScene = signal<Recommendation | null>(null);
	private readonly _authPrompt = inject(AuthPromptService);
	private readonly _destroyRef = inject(DestroyRef);
	private _recognition: SpeechRecognitionLike | null = null;
	@ViewChild('previewDialog') private _previewDialog?: ElementRef<HTMLDialogElement>;

	constructor() {
		this._destroyRef.onDestroy(() => {
			if (this._recognition) {
				this._recognition.onend = null;
				this._recognition.abort();
			}
		});
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

		let matches = HOME_RECOMMENDATIONS.filter(
			(item) => category === 'for-you' || item.tags.includes(category),
		);

		if (terms.length) {
			matches = matches.filter((item) => {
				const searchableText = `${item.title} ${item.searchText}`
					.split(/[^\p{L}\p{N}]+/u)
					.map(searchStem);
				return terms.every((term) => searchableText.some((word) => word.startsWith(term) || term.startsWith(word)));
			});
		}

		if (durationFilter === 'under-15') {
			matches = matches.filter((item) => item.duration < 15);
		} else if (durationFilter === '15-30') {
			matches = matches.filter((item) => item.duration >= 15 && item.duration <= 30);
		} else if (durationFilter === 'over-30') {
			matches = matches.filter((item) => item.duration > 30);
		}

		if (orientationFilter !== 'any') {
			matches = matches.filter((item) => item.orientation === orientationFilter);
		}

		if (qualityFilter !== 'any') {
			const minimumQuality = qualityFilter === '4k' ? 2160 : Number.parseInt(qualityFilter, 10);
			matches = matches.filter((item) => (item.quality === '4k' ? 2160 : Number.parseInt(item.quality, 10)) >= minimumQuality);
		}

		if (this.sortOrder() === 'shortest') {
			matches = [...matches].sort((left, right) => left.duration - right.duration);
		} else if (this.sortOrder() === 'longest') {
			matches = [...matches].sort((left, right) => right.duration - left.duration);
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

		this.submittedQuery.set(query);
		this.searchError.set(false);
		this.searchMessage.set(
			this.selectedPhotoName() ? 'Пошук виконується за текстом; фото поки не впливає на результати.' : '',
		);
	}

	protected setCategory(category: CategoryId) {
		this.activeCategory.set(category);
	}

	protected setSortOrder(event: Event) {
		this.sortOrder.set((event.target as HTMLSelectElement).value as SortOrder);
	}

	protected setDurationFilter(event: Event) {
		this.durationFilter.set((event.target as HTMLSelectElement).value as DurationFilter);
	}

	protected setOrientationFilter(event: Event) {
		this.orientationFilter.set((event.target as HTMLSelectElement).value as OrientationFilter);
	}

	protected setQualityFilter(event: Event) {
		this.qualityFilter.set((event.target as HTMLSelectElement).value as QualityFilter);
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
			this.searchMessage.set('');
			this.searchError.set(false);
		};
		recognition.onerror = (event) => {
			if (event.error === 'aborted') {
				return;
			}

			this.searchError.set(true);
			this.searchMessage.set(event.error === 'not-allowed'
				? 'Дозвольте доступ до мікрофона, щоб скористатися голосовим пошуком.'
				: 'Не вдалося розпізнати запит. Спробуйте ще раз.');
		};
		recognition.onend = () => {
			this.isListening.set(false);
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

	protected openPreview(item: Recommendation) {
		this.previewScene.set(item);
		this._previewDialog?.nativeElement.showModal();
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

	protected resetSearch(input: HTMLInputElement) {
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
		input.value = '';
	}

	protected promptForSignIn() {
		this._authPrompt.open('saved');
	}
}
