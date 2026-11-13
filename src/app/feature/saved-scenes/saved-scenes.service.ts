import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { FirebaseAuthService } from '../firebase-auth/firebase-auth.service';

export interface SavedScene {
	id: string;
	title: string;
	tags: string[];
	duration: number;
	durationLabel: string;
	orientation: 'landscape' | 'portrait';
	quality: '480p' | '720p' | '1080p' | '4k';
	searchText: string;
	scene: 'mountains' | 'city' | 'coast' | 'forest' | 'night' | 'desert';
	provider?: string;
	thumbnailUrl?: string;
	videoUrl?: string;
	videoMimeType?: string;
	sourcePageUrl?: string;
	authorName?: string;
	licenseName?: string;
	licenseUrl?: string;
	folderId?: string | null;
	savedAt?: number;
}

export interface SavedFolder {
	id: string;
	name: string;
	createdAt: number;
}

type FirestoreSdk = typeof import('firebase/firestore');

@Service()
export class SavedScenesService {
	private readonly _platformId = inject(PLATFORM_ID);
	private readonly _auth = inject(FirebaseAuthService);
	private _firestorePromise: Promise<{ firestore: Firestore; sdk: FirestoreSdk }> | null = null;
	readonly scenes = signal<SavedScene[]>([]);
	readonly folders = signal<SavedFolder[]>([]);
	readonly loadedForUid = signal<string | null>(null);
	readonly busyIds = signal<string[]>([]);
	readonly message = signal('');

	async load() {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			this.scenes.set([]);
			this.folders.set([]);
			this.loadedForUid.set(null);
			return;
		}
		if (this.loadedForUid() === user.uid) {
			return;
		}

		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const [sceneSnapshot, folderSnapshot] = await Promise.all([
				sdk.getDocs(sdk.collection(firestore, 'users', user.uid, 'savedScenes')),
				sdk.getDocs(sdk.collection(firestore, 'users', user.uid, 'savedFolders')),
			]);
			this.scenes.set(sceneSnapshot.docs.map((item) => item.data() as SavedScene));
			this.folders.set(
				folderSnapshot.docs
					.map((item) => ({ ...(item.data() as Omit<SavedFolder, 'id'>), id: item.id }))
					.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
			);
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set(
				'Не вдалося завантажити збережене. Перевірте налаштування бази даних Firebase.',
			);
			throw new Error(this.message());
		}
	}

	async createFolder(name: string) {
		this.message.set('');
		const cleanName = this._normalizeFolderName(name);
		const user = await this._requireUser();
		if (
			this.folders().some(
				(folder) => folder.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
			)
		) {
			throw new Error('Папка з такою назвою вже існує.');
		}
		try {
			const { firestore, sdk } = await this._getFirestore();
			const folderRef = sdk.doc(sdk.collection(firestore, 'users', user.uid, 'savedFolders'));
			const folder: SavedFolder = {
				id: folderRef.id,
				name: cleanName,
				createdAt: Date.now(),
			};
			await sdk.setDoc(folderRef, { name: folder.name, createdAt: folder.createdAt });
			this.folders.update((items) => [...items, folder]);
			return folder;
		} catch (error) {
			const message =
				'Не вдалося створити папку. Перевірте правила Firestore у Firebase Console.';
			this.message.set(message);
			throw new Error(message, { cause: error });
		}
	}

	async renameFolder(id: string, name: string) {
		this.message.set('');
		const cleanName = this._normalizeFolderName(name);
		const user = await this._requireUser();
		if (
			this.folders().some(
				(folder) =>
					folder.id !== id &&
					folder.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
			)
		) {
			throw new Error('Папка з такою назвою вже існує.');
		}
		try {
			const { firestore, sdk } = await this._getFirestore();
			await sdk.updateDoc(sdk.doc(firestore, 'users', user.uid, 'savedFolders', id), {
				name: cleanName,
			});
			this.folders.update((items) =>
				items.map((folder) => (folder.id === id ? { ...folder, name: cleanName } : folder)),
			);
		} catch (error) {
			const message =
				'Не вдалося перейменувати папку. Перевірте правила Firestore у Firebase Console.';
			this.message.set(message);
			throw new Error(message, { cause: error });
		}
	}

	async moveScene(sceneId: string, folderId: string | null) {
		const user = await this._requireUser();
		if (folderId && !this.folders().some((folder) => folder.id === folderId)) {
			throw new Error('Цю папку не знайдено.');
		}
		this.busyIds.update((ids) => [...new Set([...ids, sceneId])]);
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			await sdk.updateDoc(sdk.doc(firestore, 'users', user.uid, 'savedScenes', sceneId), {
				folderId,
			});
			this.scenes.update((items) =>
				items.map((scene) => (scene.id === sceneId ? { ...scene, folderId } : scene)),
			);
		} catch (error) {
			this.message.set('Не вдалося перемістити сцену. Перевірте правила Firestore.');
			throw error;
		} finally {
			this.busyIds.update((ids) => ids.filter((id) => id !== sceneId));
		}
	}

	async deleteFolder(id: string) {
		const user = await this._requireUser();
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const scenesToMove = this.scenes().filter((scene) => scene.folderId === id);
			for (let start = 0; start < scenesToMove.length; start += 450) {
				const batch = sdk.writeBatch(firestore);
				for (const scene of scenesToMove.slice(start, start + 450)) {
					batch.update(sdk.doc(firestore, 'users', user.uid, 'savedScenes', scene.id), {
						folderId: null,
					});
				}
				await batch.commit();
			}
			await sdk.deleteDoc(sdk.doc(firestore, 'users', user.uid, 'savedFolders', id));
			this.scenes.update((items) =>
				items.map((scene) =>
					scene.folderId === id ? { ...scene, folderId: null } : scene,
				),
			);
			this.folders.update((items) => items.filter((folder) => folder.id !== id));
		} catch (error) {
			const message =
				'Не вдалося видалити папку. Перевірте правила Firestore у Firebase Console.';
			this.message.set(message);
			throw new Error(message, { cause: error });
		}
	}

	async toggle(scene: SavedScene) {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user) {
			throw new Error('Увійдіть, щоб зберігати відеосцени.');
		}

		this.busyIds.update((ids) => [...new Set([...ids, scene.id])]);
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const sceneRef = sdk.doc(firestore, 'users', user.uid, 'savedScenes', scene.id);
			if (this.scenes().some((item) => item.id === scene.id)) {
				await sdk.deleteDoc(sceneRef);
				this.scenes.update((items) => items.filter((item) => item.id !== scene.id));
			} else {
				const savedScene = { ...scene, savedAt: Date.now() };
				await sdk.setDoc(sceneRef, savedScene);
				this.scenes.update((items) => [savedScene, ...items]);
			}
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set(
				'Не вдалося зберегти сцену. Перевірте, чи створено базу Firestore та правила доступу.',
			);
			throw new Error(this.message());
		} finally {
			this.busyIds.update((ids) => ids.filter((id) => id !== scene.id));
		}
	}

	private async _requireUser() {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user) {
			throw new Error('Увійдіть, щоб керувати папками зі збереженим.');
		}
		return user;
	}

	private _normalizeFolderName(name: string) {
		const cleanName = name.trim().replace(/\s+/g, ' ');
		if (!cleanName) {
			throw new Error('Введіть назву папки.');
		}
		if (cleanName.length > 40) {
			throw new Error('Назва папки має містити не більше 40 символів.');
		}
		return cleanName;
	}

	isSaved(id: string) {
		return this.scenes().some((scene) => scene.id === id);
	}

	private async _getFirestore(): Promise<{ firestore: Firestore; sdk: FirestoreSdk }> {
		if (!isPlatformBrowser(this._platformId)) {
			throw new Error('Збереження доступне в браузері.');
		}
		if (!this._firestorePromise) {
			this._firestorePromise = (async () => {
				const [appSdk, sdk] = await Promise.all([
					import('firebase/app'),
					import('firebase/firestore'),
				]);
				const app = appSdk.getApps()[0] ?? appSdk.initializeApp(environment.firebase);
				return { firestore: sdk.getFirestore(app), sdk };
			})();
		}
		try {
			return await this._firestorePromise;
		} catch (error) {
			this._firestorePromise = null;
			throw error;
		}
	}
}
