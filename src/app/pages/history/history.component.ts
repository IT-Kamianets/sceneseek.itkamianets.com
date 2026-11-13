import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import {
	SearchHistoryEntry,
	SearchHistoryService,
	ViewedScene,
} from '../../feature/search-history/search-history.service';

@Component({
	imports: [RouterLink],
	templateUrl: './history.component.html',
	styleUrl: './history.component.scss',
})
export class HistoryComponent {
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly history = inject(SearchHistoryService);
	protected readonly selectedViewedScene = signal<ViewedScene | null>(null);
	private readonly _router = inject(Router);
	@ViewChild('viewDialog') private _viewDialog?: ElementRef<HTMLDialogElement>;

	constructor() {
		void this.history.load().catch(() => undefined);
	}

	protected dateLabel(timestamp: number): string {
		return new Intl.DateTimeFormat('uk-UA', {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(timestamp));
	}

	protected filterLabels(entry: SearchHistoryEntry): string[] {
		const labels: string[] = [];
		const durations: Record<SearchHistoryEntry['durationFilter'], string> = {
			any: '',
			'under-15': 'До 15 с',
			'15-30': '15–30 с',
			'over-30': 'Понад 30 с',
		};
		const orientations: Record<SearchHistoryEntry['orientationFilter'], string> = {
			any: '',
			landscape: 'Горизонтальне',
			portrait: 'Вертикальне',
		};
		const qualities: Record<SearchHistoryEntry['qualityFilter'], string> = {
			any: '',
			'720p': 'HD · 720p+',
			'1080p': 'Full HD · 1080p+',
			'4k': '4K',
		};
		const categories: Record<SearchHistoryEntry['category'], string> = {
			'for-you': '',
			atmosphere: 'Атмосфера',
			cinematic: 'Кінематографічне',
			nature: 'Природа',
			city: 'Міські сцени',
		};
		const sortOrders: Record<SearchHistoryEntry['sortOrder'], string> = {
			relevance: '',
			shortest: 'Спочатку коротші',
			longest: 'Спочатку довші',
		};
		const selected = [
			durations[entry.durationFilter],
			orientations[entry.orientationFilter],
			qualities[entry.qualityFilter],
			categories[entry.category],
			sortOrders[entry.sortOrder],
			entry.hasImage ? 'Фото додавали' : '',
			entry.inputMethod === 'voice' ? 'Голосом' : '',
		];
		for (const label of selected) {
			if (label) {
				labels.push(label);
			}
		}
		return labels;
	}

	protected repeat(entry: SearchHistoryEntry) {
		void this._router.navigate(['/search'], {
			queryParams: {
				q: entry.query,
				duration: entry.durationFilter,
				orientation: entry.orientationFilter,
				quality: entry.qualityFilter,
				sort: entry.sortOrder,
				category: entry.category,
				inputMethod: entry.inputMethod,
			},
		});
	}

	protected async remove(entry: SearchHistoryEntry) {
		try {
			await this.history.remove(entry.id);
		} catch {
			// The service provides the user-facing error message.
		}
	}

	protected async clear() {
		if (!globalThis.confirm('Очистити всю історію пошуку? Цю дію не можна скасувати.')) {
			return;
		}
		try {
			await this.history.clear();
		} catch {
			// The service provides the user-facing error message.
		}
	}

	protected openViewed(scene: ViewedScene) {
		this.selectedViewedScene.set(scene);
		this._viewDialog?.nativeElement.showModal();
		void this.history.recordViewed(scene);
	}

	protected closeViewed() {
		this._viewDialog?.nativeElement.close();
		this.selectedViewedScene.set(null);
	}

	protected onViewDialogClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			this.closeViewed();
		}
	}

	protected async removeViewed(scene: ViewedScene) {
		try {
			await this.history.removeViewed(scene.id);
		} catch {
			// The service provides the user-facing error message.
		}
	}

	protected async clearViewed() {
		if (!globalThis.confirm('Очистити список переглянутих сцен? Цю дію не можна скасувати.')) {
			return;
		}
		try {
			await this.history.clearViewed();
		} catch {
			// The service provides the user-facing error message.
		}
	}
}
