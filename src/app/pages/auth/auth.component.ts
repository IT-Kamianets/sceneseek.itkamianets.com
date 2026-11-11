import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type AuthMode = 'login' | 'register' | 'reset';

@Component({
	selector: 'app-auth',
	imports: [RouterLink],
	templateUrl: './auth.component.html',
	styleUrl: './auth.component.scss',
})
export class AuthComponent {
	private readonly _route = inject(ActivatedRoute);
	protected readonly mode = signal<AuthMode>(this._route.snapshot.data['authMode'] as AuthMode);
	protected readonly email = signal('');
	protected readonly fullName = signal('');
	protected readonly password = signal('');
	protected readonly confirmPassword = signal('');
	protected readonly showPassword = signal(false);
	protected readonly formMessage = signal('');
	protected readonly formError = signal(false);
	protected readonly heading = computed(() => {
		switch (this.mode()) {
			case 'login': return 'Раді вас бачити';
			case 'register': return 'Створіть свій акаунт';
			case 'reset': return 'Відновіть доступ';
		}
	});
	protected readonly submitLabel = computed(() => {
		switch (this.mode()) {
			case 'login': return 'Увійти';
			case 'register': return 'Створити акаунт';
			case 'reset': return 'Надіслати інструкцію';
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

	protected onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		if (!form.reportValidity()) {
			return;
		}

		if (this.mode() === 'register' && this.password() !== this.confirmPassword()) {
			this.formError.set(true);
			this.formMessage.set('Паролі не збігаються. Перевірте введені дані.');
			return;
		}

		this.formError.set(false);
		this.formMessage.set(this.mode() === 'reset'
			? 'Надсилання листа поки недоступне. Вашу адресу не надіслано.'
			: 'Авторизацію ще не підключено. Введені дані не надсилалися.');
	}

	private clearMessage() {
		this.formMessage.set('');
		this.formError.set(false);
	}
}
