import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import {
	videoPlaybackVariants,
	type VideoPlaybackVariant,
} from '../../feature/coverr/coverr-video.service';
import {
	SearchHistoryEntry,
	SearchHistoryService,
	ViewedScene,
} from '../../feature/search-history/search-history.service';

@Component({
	imports: [RouterLink, TranslateDirective],
	templateUrl: './history.component.html',
	styleUrl: './history.component.scss',
})
export class HistoryComponent {
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly history = inject(SearchHistoryService);
	protected readonly selectedViewedScene = signal<ViewedScene | null>(null);
	protected readonly playbackQuality = signal<VideoPlaybackVariant['key']>('max');
	private readonly _router = inject(Router);
	private readonly _language = inject(LanguageService);
	private readonly _translate = inject(TranslateService);
	protected translateText(text: string): string {
		return this._translate.translate(text)();
	}
	@ViewChild('viewDialog') private _viewDialog?: ElementRef<HTMLDialogElement>;

	constructor() {
		void this.history.load().catch(() => undefined);
	}

	protected dateLabel(timestamp: number): string {
		return new Intl.DateTimeFormat(this._language.language() === 'ua' ? 'uk-UA' : 'en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(timestamp));
	}

	protected filterLabels(entry: SearchHistoryEntry): string[] {
		const labels: string[] = [];
		const durations: Record<SearchHistoryEntry['durationFilter'], string> = {
			any: '',
			'under-15': 'Under 15 sec',
			'15-30': '15–30 sec',
			'over-30': 'Over 30 sec',
		};
		const orientations: Record<SearchHistoryEntry['orientationFilter'], string> = {
			any: '',
			landscape: 'Landscape',
			portrait: 'Portrait',
		};
		const qualities: Record<SearchHistoryEntry['qualityFilter'], string> = {
			any: '',
			'720p': 'HD · 720p+',
			'1080p': 'Full HD · 1080p+',
			'4k': '4K',
		};
		const categories: Record<SearchHistoryEntry['category'], string> = {
			'for-you': '',
			atmosphere: 'Atmosphere',
			cinematic: 'Cinematic',
			nature: 'Nature',
			city: 'City scenes',
		};
		const sortOrders: Record<SearchHistoryEntry['sortOrder'], string> = {
			relevance: '',
			shortest: 'Shortest first',
			longest: 'Longest first',
		};
		const selected = [
			durations[entry.durationFilter],
			orientations[entry.orientationFilter],
			qualities[entry.qualityFilter],
			categories[entry.category],
			sortOrders[entry.sortOrder],
			entry.hasImage ? 'Image added' : '',
			entry.inputMethod === 'voice' ? 'Voice' : '',
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
		if (!globalThis.confirm(this.translateText('Clear your entire search history? This can’t be undone.'))) {
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
		this.playbackQuality.set('max');
		this._viewDialog?.nativeElement.showModal();
		void this.history.recordViewed(scene);
	}

	protected videoVariants(scene: ViewedScene) {
		return videoPlaybackVariants(scene);
	}

	protected selectedVideoUrl(scene: ViewedScene) {
		const variants = this.videoVariants(scene);
		return variants.find((variant) => variant.key === this.playbackQuality())?.url ?? scene.videoUrl;
	}

	protected setPlaybackQuality(event: Event) {
		this.playbackQuality.set(
			(event.target as HTMLSelectElement).value === 'preview' ? 'preview' : 'max',
		);
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
		if (!globalThis.confirm(this.translateText('Clear your viewed scenes? This can’t be undone.'))) {
			return;
		}
		try {
			await this.history.clearViewed();
		} catch {
			// The service provides the user-facing error message.
		}
	}
}
