import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Auth, User } from 'firebase/auth';
import { environment } from '../../../environments/environment';

export interface SceneSeekUser {
	uid: string;
	email: string | null;
	displayName: string | null;
}

type FirebaseAuthSdk = typeof import('firebase/auth');

@Service()
export class FirebaseAuthService {
	private readonly _platformId = inject(PLATFORM_ID);
	private readonly _firebaseConfig = environment.firebase;
	private _authPromise: Promise<{ auth: Auth; sdk: FirebaseAuthSdk }> | null = null;
	private _resolveAuthReady!: () => void;
	private readonly _authReadyPromise = new Promise<void>((resolve) => {
		this._resolveAuthReady = resolve;
	});
	readonly user = signal<SceneSeekUser | null>(null);
	readonly authReady = signal(false);
	readonly isConfigured = computed(() =>
		Boolean(
			this._firebaseConfig.apiKey &&
			this._firebaseConfig.authDomain &&
			this._firebaseConfig.projectId &&
			this._firebaseConfig.appId,
		),
	);

	async initialize() {
		if (!isPlatformBrowser(this._platformId) || !this.isConfigured()) {
			this._markAuthReady();
			return;
		}

		try {
			await this._getAuth();
		} catch {
			this._markAuthReady();
		}
	}

	async waitUntilReady() {
		if (!isPlatformBrowser(this._platformId)) {
			return;
		}
		if (!this.authReady()) {
			await this.initialize();
			await this._authReadyPromise;
		}
	}

	async signIn(email: string, password: string) {
		const { auth, sdk } = await this._getAuth();
		try {
			const credential = await sdk.signInWithEmailAndPassword(auth, email.trim(), password);
			this.user.set(this._mapUser(credential.user));
		} catch (error) {
			throw new Error(this._errorMessage(error));
		}
	}

	async createAccount(email: string, password: string, displayName: string) {
		const { auth, sdk } = await this._getAuth();
		try {
			const credential = await sdk.createUserWithEmailAndPassword(auth, email.trim(), password);
			const name = displayName.trim();
			if (name) {
				await sdk.updateProfile(credential.user, { displayName: name });
			}
			this.user.set(this._mapUser(credential.user));
		} catch (error) {
			throw new Error(this._errorMessage(error));
		}
	}

	async sendPasswordReset(email: string) {
		const { auth, sdk } = await this._getAuth();
		try {
			auth.languageCode = 'uk';
			await sdk.sendPasswordResetEmail(auth, email.trim());
		} catch (error) {
			if (this._errorCode(error) === 'auth/user-not-found') {
				return;
			}
			throw new Error(this._errorMessage(error));
		}
	}

	async signOut() {
		const { auth, sdk } = await this._getAuth();
		await sdk.signOut(auth);
		this.user.set(null);
	}

	private async _getAuth(): Promise<{ auth: Auth; sdk: FirebaseAuthSdk }> {
		if (!isPlatformBrowser(this._platformId)) {
			throw new Error('Вхід доступний у браузері.');
		}
		if (!this.isConfigured()) {
			throw new Error('Підключення Firebase ще не налаштовано. Дані не надсилалися.');
		}
		if (!this._authPromise) {
			this._authPromise = this._createAuth();
		}

		try {
			return await this._authPromise;
		} catch (error) {
			this._authPromise = null;
			throw error;
		}
	}

	private async _createAuth(): Promise<{ auth: Auth; sdk: FirebaseAuthSdk }> {
		const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
		const app = appSdk.getApps()[0] ?? appSdk.initializeApp(this._firebaseConfig);
		const auth = sdk.getAuth(app);
		auth.languageCode = 'uk';
		await sdk.setPersistence(auth, sdk.browserLocalPersistence);
		sdk.onAuthStateChanged(auth, (user) => {
			this.user.set(this._mapUser(user));
			this._markAuthReady();
		});
		return { auth, sdk };
	}

	private _markAuthReady() {
		this.authReady.set(true);
		this._resolveAuthReady();
	}

	private _mapUser(user: User | null): SceneSeekUser | null {
		return user
			? { uid: user.uid, email: user.email, displayName: user.displayName }
			: null;
	}

	private _errorMessage(error: unknown): string {
		const code = this._errorCode(error);
		const messages: Record<string, string> = {
			'auth/invalid-credential': 'Електронна пошта або пароль неправильні.',
			'auth/invalid-email': 'Перевірте формат електронної пошти.',
			'auth/email-already-in-use': 'Акаунт із такою адресою вже існує. Увійдіть або відновіть пароль.',
			'auth/weak-password': 'Створіть пароль щонайменше з 8 символів.',
			'auth/too-many-requests': 'Забагато спроб. Спробуйте пізніше.',
			'auth/network-request-failed': 'Не вдалося з’єднатися. Перевірте інтернет і спробуйте ще раз.',
			'auth/user-disabled': 'Цей акаунт тимчасово недоступний.',
			'auth/operation-not-allowed': 'Вхід електронною поштою ще не активовано в Firebase.',
			'auth/unauthorized-domain': 'Цей домен ще не доданий до дозволених у Firebase.',
		};
		if (code) {
			return messages[code] ?? 'Не вдалося виконати дію. Перевірте дані й спробуйте ще раз.';
		}
		return error instanceof Error ? error.message : 'Не вдалося виконати дію. Спробуйте ще раз.';
	}

	private _errorCode(error: unknown): string {
		return typeof error === 'object' && error !== null && 'code' in error
			? String(error.code)
			: '';
	}
}
