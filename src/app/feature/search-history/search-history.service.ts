import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { FirebaseAuthService } from '../firebase-auth/firebase-auth.service';

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

type FirestoreSdk = typeof import('firebase/firestore');

@Service()
export class SearchHistoryService {
	private readonly _platformId = inject(PLATFORM_ID);
	private readonly _auth = inject(FirebaseAuthService);
	private _firestorePromise: Promise<{ firestore: Firestore; sdk: FirestoreSdk }> | null = null;
	readonly entries = signal<SearchHistoryEntry[]>([]);
	readonly loadedForUid = signal<string | null>(null);
	readonly isLoading = signal(false);
	readonly isUpdating = signal(false);
	readonly message = signal('');

	async load() {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			this.entries.set([]);
			this.loadedForUid.set(null);
			return;
		}
		if (this.loadedForUid() === user.uid) {
			return;
		}

		this.entries.set([]);
		this.isLoading.set(true);
		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const history = sdk.collection(firestore, 'users', user.uid, 'searchHistory');
			const historyQuery = sdk.query(
				history,
				sdk.orderBy('createdAt', 'desc'),
				sdk.limit(50),
			);
			const snapshot = await sdk.getDocs(historyQuery);
			this.entries.set(
				snapshot.docs.map(
					(item) => ({ ...item.data(), id: item.id }) as SearchHistoryEntry,
				),
			);
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set(
				'Не вдалося завантажити історію. Перевірте правила доступу Firestore.',
			);
			throw new Error(this.message());
		} finally {
			this.isLoading.set(false);
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
				'Пошук виконано, але не вдалося зберегти його в історії. Перевірте правила Firestore.',
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
			this.message.set('Не вдалося видалити запис з історії. Спробуйте ще раз.');
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
			this.message.set('Не вдалося очистити історію. Спробуйте ще раз.');
			throw new Error(this.message());
		} finally {
			this.isUpdating.set(false);
		}
	}

	private async _getFirestore(): Promise<{ firestore: Firestore; sdk: FirestoreSdk }> {
		if (!isPlatformBrowser(this._platformId)) {
			throw new Error('Історія пошуку доступна у браузері.');
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
