import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import { SavedScenesService } from '../../feature/saved-scenes/saved-scenes.service';

@Component({
	selector: 'app-saved',
	imports: [RouterLink],
	templateUrl: './saved.component.html',
	styleUrl: './saved.component.scss',
})
export class SavedComponent {
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly saved = inject(SavedScenesService);
	protected readonly activeFolder = signal('all');
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
						: 'Не вдалося створити папку.',
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
						: 'Не вдалося перейменувати папку.',
			);
		} finally {
			this.savingFolder.set(false);
		}
	}

	protected async deleteFolder(id: string, name: string) {
		if (!globalThis.confirm(`Видалити папку «${name}»? Сцени залишаться у «Без папки».`)) {
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
						: 'Не вдалося видалити папку.',
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

	protected folderSceneCount(folderId: string) {
		return this.saved.scenes().filter((scene) => scene.folderId === folderId).length;
	}
}
