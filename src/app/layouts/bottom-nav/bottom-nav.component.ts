import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';

@Component({
	selector: 'app-bottom-nav',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './bottom-nav.component.html',
	styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
	private readonly _authPrompt = inject(AuthPromptService);
	private readonly _auth = inject(FirebaseAuthService);

	protected async promptForSignIn(reason: 'history' | 'saved') {
		await this._auth.waitUntilReady();
		if (!this._auth.user()) {
			this._authPrompt.open(reason);
		}
	}
}
