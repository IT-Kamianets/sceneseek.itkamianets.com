import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import { TranslateDirective, TranslateService } from '@wawjs/ngx-translate';

type AuthMode = 'login' | 'register' | 'reset';

@Component({
	selector: 'app-auth',
	imports: [RouterLink, TranslateDirective],
	templateUrl: './auth.component.html',
	styleUrl: './auth.component.scss',
})
export class AuthComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _auth = inject(FirebaseAuthService);
	private readonly _translate = inject(TranslateService);
	protected translateText(text: string): string {
		return this._translate.translate(text)();
	}
	private readonly _returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');
	protected readonly returnUrlParams = this._returnUrl ? { returnUrl: this._returnUrl } : null;
	protected readonly mode = signal<AuthMode>(this._route.snapshot.data['authMode'] as AuthMode);
	protected readonly email = signal('');
	protected readonly fullName = signal('');
	protected readonly password = signal('');
	protected readonly confirmPassword = signal('');
	protected readonly showPassword = signal(false);
	protected readonly formMessage = signal('');
	protected readonly formError = signal(false);
	protected readonly isSubmitting = signal(false);
	protected readonly heading = computed(() => {
		switch (this.mode()) {
			case 'login': return 'Welcome back';
			case 'register': return 'Create your account';
			case 'reset': return 'Reset your password';
		}
	});
	protected readonly submitLabel = computed(() => {
		switch (this.mode()) {
			case 'login': return 'Sign in';
			case 'register': return 'Create account';
			case 'reset': return 'Send instructions';
		}
	});

	protected updateEmail(event: Event) {
		this.email.set((event.target as HTMLInputElement).value);
		this.clearMessage();
	}

	protected updateName(event: Event) {
		this.fullName.set((event.target as HTMLInputElement).value);
		this.clearMessage();
	}

	protected updatePassword(event: Event) {
		this.password.set((event.target as HTMLInputElement).value);
		this.clearMessage();
	}

	protected updateConfirmPassword(event: Event) {
		this.confirmPassword.set((event.target as HTMLInputElement).value);
		this.clearMessage();
	}

	protected togglePasswordVisibility() {
		this.showPassword.update((visible) => !visible);
	}

	protected async signInWithGoogle() {
		if (this.isSubmitting()) {
			return;
		}
		this.isSubmitting.set(true);
		this.clearMessage();
		try {
			await this._auth.signInWithGoogle();
			await this._router.navigateByUrl(this._safeReturnUrl());
		} catch (error) {
			this.formError.set(true);
			this.formMessage.set(error instanceof Error ? error.message : 'Could not sign in with Google. Please try again.');
		} finally {
			this.isSubmitting.set(false);
		}
	}

	protected async onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (this.isSubmitting()) {
			return;
		}
		const form = event.currentTarget as HTMLFormElement;
		if (!form.reportValidity()) {
			return;
		}

		if (this.mode() === 'register' && this.password() !== this.confirmPassword()) {
			this.formError.set(true);
			this.formMessage.set('Passwords do not match. Please check your entries.');
			return;
		}

		this.isSubmitting.set(true);
		this.clearMessage();
		try {
			switch (this.mode()) {
				case 'login':
					await this._auth.signIn(this.email(), this.password());
					await this._router.navigateByUrl(this._safeReturnUrl());
					break;
				case 'register':
					await this._auth.createAccount(this.email(), this.password(), this.fullName());
					await this._router.navigateByUrl(this._safeReturnUrl());
					break;
				case 'reset':
					await this._auth.sendPasswordReset(this.email());
					this.formMessage.set('If an account exists for this email address, we’ve sent a message with instructions.');
					break;
			}
		} catch (error) {
			this.formError.set(true);
			this.formMessage.set(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
		} finally {
			this.isSubmitting.set(false);
		}
	}

	private _safeReturnUrl(): string {
		return this._returnUrl?.startsWith('/') && !this._returnUrl.startsWith('//')
			? this._returnUrl
			: '/';
	}

	private clearMessage() {
		this.formMessage.set('');
		this.formError.set(false);
	}
}
