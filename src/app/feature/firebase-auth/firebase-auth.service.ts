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

	async signInWithGoogle() {
		const { auth, sdk } = await this._getAuth();
		try {
			const provider = new sdk.GoogleAuthProvider();
			provider.setCustomParameters({ prompt: 'select_account' });
			const credential = await sdk.signInWithPopup(auth, provider);
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
			auth.languageCode = 'en';
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
			throw new Error('Sign-in is available in a browser.');
		}
		if (!this.isConfigured()) {
			throw new Error('Firebase sign-in is not configured yet. No data was sent.');
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
		auth.languageCode = 'en';
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
			'auth/invalid-credential': 'The email address or password is incorrect.',
			'auth/invalid-email': 'Check the email address format.',
			'auth/email-already-in-use': 'An account with this email address already exists. Sign in or reset your password.',
			'auth/weak-password': 'Choose a password with at least 8 characters.',
			'auth/too-many-requests': 'Too many attempts. Please try again later.',
			'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
			'auth/user-disabled': 'This account is temporarily unavailable.',
			'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
			'auth/unauthorized-domain': 'This domain has not been added to the authorized domains in Firebase.',
			'auth/popup-closed-by-user': 'Google sign-in was canceled.',
			'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
			'auth/cancelled-popup-request': 'Google sign-in was canceled. Please try again.',
			'auth/account-exists-with-different-credential': 'An account for this email uses a different sign-in method. Try that method instead.',
		};
		if (code) {
			return messages[code] ?? 'Something went wrong. Check your details and try again.';
		}
		return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
	}

	private _errorCode(error: unknown): string {
		return typeof error === 'object' && error !== null && 'code' in error
			? String(error.code)
			: '';
	}
}
