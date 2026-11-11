import { Component, computed, inject, signal } from '@angular/core';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';

type CategoryId = 'for-you' | 'atmosphere' | 'cinematic' | 'nature' | 'city';
type RecommendationTag = Exclude<CategoryId, 'for-you'>;
type SortOrder = 'relevance' | 'shortest' | 'longest';
type DurationFilter = 'any' | 'under-15' | '15-30' | 'over-30';
type OrientationFilter = 'any' | 'landscape' | 'portrait';

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
		searchText: 'світанок гори гірське озеро туман вода природа ранок',
		scene: 'mountains',
	},
	{
		id: 'city',
		title: 'Міські вулиці після дощу',
		tags: ['atmosphere', 'cinematic', 'city'],
		duration: 12,
		durationLabel: '00:12',
		orientation: 'portrait',
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
	private readonly _authPrompt = inject(AuthPromptService);
	protected readonly recommendations = computed(() => {
		const category = this.activeCategory();
		const terms = this.submittedQuery()
			.toLocaleLowerCase('uk')
			.split(/\s+/)
			.filter((term) => term.length > 1);
		const durationFilter = this.durationFilter();
		const orientationFilter = this.orientationFilter();

		let matches = HOME_RECOMMENDATIONS.filter(
			(item) => category === 'for-you' || item.tags.includes(category),
		);

		if (terms.length) {
			matches = matches.filter((item) =>
				terms.some((term) => item.searchText.includes(term)),
			);
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
		this.sortOrder.set('relevance');
		input.value = '';
	}

	protected promptForSignIn() {
		this._authPrompt.open('saved');
	}
}
