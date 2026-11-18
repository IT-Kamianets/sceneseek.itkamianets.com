import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import { SavedScenesService } from '../../feature/saved-scenes/saved-scenes.service';

const normalizeSearchText = (value: string) =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase('en-US');

@Component({
	selector: 'app-saved',
	imports: [RouterLink, TranslateDirective],
	templateUrl: './saved.component.html',
	styleUrl: './saved.component.scss',
})
export class SavedComponent {
	private readonly _language = inject(LanguageService);
	private readonly _translate = inject(TranslateService);
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly saved = inject(SavedScenesService);
	protected readonly activeFolder = signal('all');
	protected readonly searchQuery = signal('');
	protected readonly sortOrder = signal<'newest' | 'oldest' | 'title'>('newest');
	protected readonly newFolderName = signal('');
	protected readonly editingFolderId = signal<string | null>(null);
	protected readonly editingFolderName = signal('');
	protected readonly folderError = signal('');
	protected readonly savingFolder = signal(false);
	protected readonly unfiledCount = computed(
		() => this.saved.scenes().filter((scene) => !scene.folderId).length,
	);
	protected readonly visibleScenes = computed(() => {
		const folderId = this.activeFolder();
		if (folderId === 'all') {
			return this.saved.scenes();
		}
		if (folderId === 'unfiled') {
			return this.saved.scenes().filter((scene) => !scene.folderId);
		}
		return this.saved.scenes().filter((scene) => scene.folderId === folderId);
	});
	protected readonly filteredScenes = computed(() => {
		const query = normalizeSearchText(this.searchQuery().trim());
		const scenes = this.visibleScenes().filter((scene) => {
			if (!query) {
				return true;
			}
			const searchableText = normalizeSearchText(
				[scene.title, scene.searchText, ...scene.tags].filter(Boolean).join(' '),
			);
			return searchableText.includes(query);
		});
		return [...scenes].sort((a, b) => {
			const titleOrder = a.title.localeCompare(b.title, 'en-US', { sensitivity: 'base' });
			if (this.sortOrder() === 'title') {
				return titleOrder;
			}
			if (a.savedAt == null && b.savedAt != null) {
				return 1;
			}
			if (a.savedAt != null && b.savedAt == null) {
				return -1;
			}
			const timeOrder = (a.savedAt ?? 0) - (b.savedAt ?? 0);
			return (this.sortOrder() === 'newest' ? -timeOrder : timeOrder) || titleOrder;
		});
	});

	protected translateText(text: string): string {
		return this._translate.translate(text)();
	}

	constructor() {
		void this.saved.load().catch(() => undefined);
	}

	protected async remove(id: string) {
		const scene = this.saved.scenes().find((item) => item.id === id);
		if (!scene) {
			return;
		}
		try {
			await this.saved.toggle(scene);
		} catch {
			// The service provides the user-facing error message.
		}
	}

	protected async createFolder(event: SubmitEvent) {
		event.preventDefault();
		this.folderError.set('');
		this.savingFolder.set(true);
		try {
			const folder = await this.saved.createFolder(this.newFolderName());
			this.newFolderName.set('');
			this.activeFolder.set(folder.id);
		} catch (error) {
			this.folderError.set(
				this.saved.message()
					? ''
					: error instanceof Error
						? error.message
						: 'Could not create the folder.',
			);
		} finally {
			this.savingFolder.set(false);
		}
	}

	protected beginRename(id: string, name: string) {
		this.editingFolderId.set(id);
		this.editingFolderName.set(name);
	}

	protected async renameFolder(event: SubmitEvent) {
		event.preventDefault();
		const id = this.editingFolderId();
		if (!id) {
			return;
		}
		this.folderError.set('');
		this.savingFolder.set(true);
		try {
			await this.saved.renameFolder(id, this.editingFolderName());
			this.editingFolderId.set(null);
		} catch (error) {
			this.folderError.set(
				this.saved.message()
					? ''
					: error instanceof Error
						? error.message
						: 'Could not rename the folder.',
			);
		} finally {
			this.savingFolder.set(false);
		}
	}

	protected async deleteFolder(id: string, name: string) {
		if (!globalThis.confirm(this._translate.interpolate(this.translateText('Delete folder «{{name}}»? Scenes will remain in Unfiled.'), { name }))) {
			return;
		}
		this.folderError.set('');
		this.savingFolder.set(true);
		try {
			await this.saved.deleteFolder(id);
			if (this.activeFolder() === id) {
				this.activeFolder.set('unfiled');
			}
		} catch (error) {
			this.folderError.set(
				this.saved.message()
					? ''
					: error instanceof Error
						? error.message
						: 'Could not delete the folder.',
			);
		} finally {
			this.savingFolder.set(false);
		}
	}

	protected async moveScene(sceneId: string, event: Event) {
		const folderId = (event.target as HTMLSelectElement).value || null;
		try {
			await this.saved.moveScene(sceneId, folderId);
		} catch {
			// The service provides the user-facing error message.
		}
	}

	protected setNewFolderName(event: Event) {
		this.newFolderName.set((event.target as HTMLInputElement).value);
	}

	protected setEditingFolderName(event: Event) {
		this.editingFolderName.set((event.target as HTMLInputElement).value);
	}

	protected setSearchQuery(event: Event) {
		this.searchQuery.set((event.target as HTMLInputElement).value);
	}

	protected setSortOrder(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		if (value === 'newest' || value === 'oldest' || value === 'title') {
			this.sortOrder.set(value);
		}
	}

	protected folderSceneCount(folderId: string) {
		return this.saved.scenes().filter((scene) => scene.folderId === folderId).length;
	}

	protected savedDateLabel(savedAt?: number) {
		if (savedAt == null) {
			return 'Date added unknown';
		}
		return this._translate.interpolate(this.translateText('Saved {{date}}'), { date: new Intl.DateTimeFormat(this._language.language() === 'ua' ? 'uk-UA' : 'en-US', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		}).format(new Date(savedAt)) });
	}
}
