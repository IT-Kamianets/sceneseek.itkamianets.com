import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { FirebaseAuthService } from '../firebase-auth/firebase-auth.service';
import type { SavedScene } from '../saved-scenes/saved-scenes.service';

export type SearchHistorySortOrder = 'relevance' | 'shortest' | 'longest';
export type SearchHistoryDuration = 'any' | 'under-15' | '15-30' | 'over-30';
export type SearchHistoryOrientation = 'any' | 'landscape' | 'portrait';
export type SearchHistoryQuality = 'any' | '720p' | '1080p' | '4k';
export type SearchHistoryCategory = 'for-you' | 'atmosphere' | 'cinematic' | 'nature' | 'city';
export type SearchHistoryInputMethod = 'text' | 'voice';

export interface SearchHistoryDraft {
	query: string;
	durationFilter: SearchHistoryDuration;
	orientationFilter: SearchHistoryOrientation;
	qualityFilter: SearchHistoryQuality;
	sortOrder: SearchHistorySortOrder;
	category: SearchHistoryCategory;
	inputMethod: SearchHistoryInputMethod;
	hasImage: boolean;
}

export interface SearchHistoryEntry extends SearchHistoryDraft {
	id: string;
	createdAt: number;
}

export interface ViewedScene extends SavedScene {
	viewedAt: number;
}

type FirestoreSdk = typeof import('firebase/firestore');

@Service()
export class SearchHistoryService {
	private readonly _platformId = inject(PLATFORM_ID);
	private readonly _auth = inject(FirebaseAuthService);
	private _firestorePromise: Promise<{ firestore: Firestore; sdk: FirestoreSdk }> | null = null;
	readonly entries = signal<SearchHistoryEntry[]>([]);
	readonly viewedScenes = signal<ViewedScene[]>([]);
	readonly loadedForUid = signal<string | null>(null);
	readonly isLoading = signal(false);
	readonly isUpdating = signal(false);
	readonly isUpdatingViewed = signal(false);
	readonly viewedMessage = signal('');
	readonly message = signal('');

	async load() {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			this.entries.set([]);
			this.viewedScenes.set([]);
			this.loadedForUid.set(null);
			return;
		}
		if (this.loadedForUid() === user.uid) {
			return;
		}

		this.entries.set([]);
		this.viewedScenes.set([]);
		this.isLoading.set(true);
		this.message.set('');
		this.viewedMessage.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const history = sdk.collection(firestore, 'users', user.uid, 'searchHistory');
			const historyQuery = sdk.query(
				history,
				sdk.orderBy('createdAt', 'desc'),
				sdk.limit(50),
			);
			const viewed = sdk.collection(firestore, 'users', user.uid, 'viewedScenes');
			const viewedQuery = sdk.query(viewed, sdk.orderBy('viewedAt', 'desc'), sdk.limit(50));
			const [searchResult, viewedResult] = await Promise.allSettled([
				sdk.getDocs(historyQuery),
				sdk.getDocs(viewedQuery),
			]);
			if (searchResult.status === 'rejected') {
				throw searchResult.reason;
			}
			this.entries.set(
				searchResult.value.docs.map(
					(item) => ({ ...item.data(), id: item.id }) as SearchHistoryEntry,
				),
			);
			if (viewedResult.status === 'fulfilled') {
				this.viewedScenes.set(
					viewedResult.value.docs.map(
						(item) => ({ ...item.data(), id: item.id }) as ViewedScene,
					),
				);
			} else {
				this.viewedMessage.set(
					'Could not load viewed scenes. Check your Firestore access rules.',
				);
			}
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set(
				'Could not load history. Check your Firestore access rules.',
			);
			throw new Error(this.message());
		} finally {
			this.isLoading.set(false);
		}
	}

	async recordViewed(scene: SavedScene) {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			return;
		}

		const viewedScene: ViewedScene = {
			id: scene.id,
			title: scene.title,
			tags: scene.tags,
			duration: scene.duration,
			durationLabel: scene.durationLabel,
			orientation: scene.orientation,
			quality: scene.quality,
			searchText: scene.searchText,
			scene: scene.scene,
			viewedAt: Date.now(),
		};
		if (scene.provider) viewedScene.provider = scene.provider;
		if (scene.providerUrl) viewedScene.providerUrl = scene.providerUrl;
		if (scene.thumbnailUrl) viewedScene.thumbnailUrl = scene.thumbnailUrl;
		if (scene.videoUrl) viewedScene.videoUrl = scene.videoUrl;
		if (scene.videoPreviewUrl) viewedScene.videoPreviewUrl = scene.videoPreviewUrl;
		if (scene.videoPreviewQuality) viewedScene.videoPreviewQuality = scene.videoPreviewQuality;
		if (scene.videoMimeType) viewedScene.videoMimeType = scene.videoMimeType;
		if (scene.sourcePageUrl) viewedScene.sourcePageUrl = scene.sourcePageUrl;
		if (scene.authorName) viewedScene.authorName = scene.authorName;
		if (scene.authorUrl) viewedScene.authorUrl = scene.authorUrl;
		if (scene.licenseName) viewedScene.licenseName = scene.licenseName;
		if (scene.licenseUrl) viewedScene.licenseUrl = scene.licenseUrl;

		try {
			const { firestore, sdk } = await this._getFirestore();
			await sdk.setDoc(
				sdk.doc(firestore, 'users', user.uid, 'viewedScenes', scene.id),
				viewedScene,
			);
			this.viewedMessage.set('');
			if (this.loadedForUid() === user.uid) {
				this.viewedScenes.update((items) =>
					[viewedScene, ...items.filter((item) => item.id !== scene.id)]
						.sort((a, b) => b.viewedAt - a.viewedAt)
						.slice(0, 50),
				);
			}
		} catch {
			this.viewedMessage.set(
				'Scene opened, but it could not be saved to your history. Check your Firestore rules.',
			);
		}
	}

	async removeViewed(sceneId: string) {
		const user = this._auth.user();
		if (!user) {
			return;
		}
		this.isUpdatingViewed.set(true);
		this.viewedMessage.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			await sdk.deleteDoc(sdk.doc(firestore, 'users', user.uid, 'viewedScenes', sceneId));
			this.viewedScenes.update((items) => items.filter((item) => item.id !== sceneId));
		} catch {
			this.viewedMessage.set('Could not remove the scene from history. Please try again.');
			throw new Error(this.viewedMessage());
		} finally {
			this.isUpdatingViewed.set(false);
		}
	}

	async clearViewed() {
		const user = this._auth.user();
		if (!user) {
			return;
		}
		this.isUpdatingViewed.set(true);
		this.viewedMessage.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const viewed = sdk.collection(firestore, 'users', user.uid, 'viewedScenes');
			const snapshot = await sdk.getDocs(viewed);
			for (let index = 0; index < snapshot.docs.length; index += 500) {
				const batch = sdk.writeBatch(firestore);
				for (const item of snapshot.docs.slice(index, index + 500)) {
					batch.delete(item.ref);
				}
				await batch.commit();
			}
			this.viewedScenes.set([]);
		} catch {
			this.viewedMessage.set('Could not clear viewed scenes. Please try again.');
			throw new Error(this.viewedMessage());
		} finally {
			this.isUpdatingViewed.set(false);
		}
	}

	async record(draft: SearchHistoryDraft) {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			return;
		}

		const entry: SearchHistoryEntry = {
			...draft,
			id: '',
			query: draft.query.trim(),
			createdAt: Date.now(),
		};
		if (!entry.query) {
			return;
		}

		try {
			const { firestore, sdk } = await this._getFirestore();
			const history = sdk.collection(firestore, 'users', user.uid, 'searchHistory');
			const entryRef = sdk.doc(history);
			const storedEntry = { ...entry, id: entryRef.id };
			await sdk.setDoc(entryRef, storedEntry);
			if (this.loadedForUid() === user.uid) {
				this.entries.update((items) => [storedEntry, ...items].slice(0, 50));
			}
		} catch {
			this.message.set(
				'Search completed, but it could not be saved to your history. Check your Firestore rules.',
			);
			throw new Error(this.message());
		}
	}

	async remove(id: string) {
		const user = this._auth.user();
		if (!user) {
			return;
		}

		this.isUpdating.set(true);
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			await sdk.deleteDoc(sdk.doc(firestore, 'users', user.uid, 'searchHistory', id));
			this.entries.update((items) => items.filter((item) => item.id !== id));
		} catch {
			this.message.set('Could not delete the history entry. Please try again.');
			throw new Error(this.message());
		} finally {
			this.isUpdating.set(false);
		}
	}

	async clear() {
		const user = this._auth.user();
		if (!user) {
			return;
		}

		this.isUpdating.set(true);
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const history = sdk.collection(firestore, 'users', user.uid, 'searchHistory');
			const snapshot = await sdk.getDocs(history);
			for (let index = 0; index < snapshot.docs.length; index += 500) {
				const batch = sdk.writeBatch(firestore);
				for (const entry of snapshot.docs.slice(index, index + 500)) {
					batch.delete(entry.ref);
				}
				await batch.commit();
			}
			this.entries.set([]);
		} catch {
			this.message.set('Could not clear history. Please try again.');
			throw new Error(this.message());
		} finally {
			this.isUpdating.set(false);
		}
	}

	private async _getFirestore(): Promise<{ firestore: Firestore; sdk: FirestoreSdk }> {
		if (!isPlatformBrowser(this._platformId)) {
			throw new Error('Search history is available in a browser.');
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
