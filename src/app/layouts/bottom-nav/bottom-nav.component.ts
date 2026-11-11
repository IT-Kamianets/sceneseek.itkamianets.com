import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';

@Component({
	selector: 'app-bottom-nav',
	imports: [RouterLink, RouterLinkActive],
	host: {
		'[class.sidebar--expanded]': 'expanded()',
	},
	templateUrl: './bottom-nav.component.html',
	styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
	private readonly _authPrompt = inject(AuthPromptService);
	private readonly _auth = inject(FirebaseAuthService);
	protected readonly expanded = signal(false);

	protected toggleExpanded() {
		this.expanded.update((expanded) => !expanded);
	}

	protected async promptForSignIn(reason: 'history' | 'saved') {
		await this._auth.waitUntilReady();
		if (!this._auth.user()) {
			this._authPrompt.open(reason);
		}
	}
}
