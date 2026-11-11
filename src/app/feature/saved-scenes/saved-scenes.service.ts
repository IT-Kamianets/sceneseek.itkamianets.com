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
	quality: '720p' | '1080p' | '4k';
	searchText: string;
	scene: 'mountains' | 'city' | 'coast' | 'forest' | 'night' | 'desert';
}

type FirestoreSdk = typeof import('firebase/firestore');

@Service()
export class SavedScenesService {
	private readonly _platformId = inject(PLATFORM_ID);
	private readonly _auth = inject(FirebaseAuthService);
	private _firestorePromise: Promise<{ firestore: Firestore; sdk: FirestoreSdk }> | null = null;
	readonly scenes = signal<SavedScene[]>([]);
	readonly loadedForUid = signal<string | null>(null);
	readonly busyIds = signal<string[]>([]);
	readonly message = signal('');

	async load() {
		await this._auth.waitUntilReady();
		const user = this._auth.user();
		if (!user || !isPlatformBrowser(this._platformId)) {
			this.scenes.set([]);
			this.loadedForUid.set(null);
			return;
		}
		if (this.loadedForUid() === user.uid) {
			return;
		}

		this.message.set('');
		try {
			const { firestore, sdk } = await this._getFirestore();
			const snapshot = await sdk.getDocs(sdk.collection(firestore, 'users', user.uid, 'savedScenes'));
			this.scenes.set(snapshot.docs.map((item) => item.data() as SavedScene));
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set('Не вдалося завантажити збережене. Перевірте налаштування бази даних Firebase.');
			throw new Error(this.message());
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
				await sdk.setDoc(sceneRef, scene);
				this.scenes.update((items) => [scene, ...items]);
			}
			this.loadedForUid.set(user.uid);
		} catch {
			this.message.set('Не вдалося зберегти сцену. Перевірте, чи створено базу Firestore та правила доступу.');
			throw new Error(this.message());
		} finally {
			this.busyIds.update((ids) => ids.filter((id) => id !== scene.id));
		}
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
				const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
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
