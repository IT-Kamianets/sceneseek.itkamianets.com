import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import { environment } from '../../../environments/environment';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';

type ProfileTheme = 'light' | 'dark';

@Component({
	selector: 'app-profile',
	imports: [RouterLink],
	templateUrl: './profile.component.html',
	styleUrl: './profile.component.scss',
})
export class ProfileComponent {
	private readonly _themeService = inject(ThemeService);
	private readonly _languageService = inject(LanguageService);
	private readonly _translateService = inject(TranslateService);
	private readonly _router = inject(Router);
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly signOutMessage = signal('');
	protected readonly initials = computed(() => {
		const label = this.auth.user()?.displayName ?? this.auth.user()?.email ?? 'SceneSeek';
		return label.split(/[\s@._-]+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('uk')).join('') || 'SS';
	});

	protected readonly themeMode = computed<ProfileTheme>(() =>
		this._themeService.mode() === 'dark' ? 'dark' : 'light',
	);
	protected readonly languages = environment.languages;
	protected readonly currentLanguage = this._languageService.language;

	protected setTheme(mode: ProfileTheme) {
		this._themeService.setMode(mode);
	}

	protected async setLanguage(language: string) {
		await this._translateService.setLanguage(language);
		await this._router.navigateByUrl(this._router.url);
	}

	protected onLanguageChange(event: Event) {
		const language = (event.target as HTMLSelectElement).value;
		void this.setLanguage(language);
	}

	protected async signOut() {
		this.signOutMessage.set('');
		try {
			await this.auth.signOut();
			await this._router.navigateByUrl('/');
		} catch (error) {
			this.signOutMessage.set(error instanceof Error ? error.message : 'Не вдалося вийти з акаунта.');
		}
	}
}
