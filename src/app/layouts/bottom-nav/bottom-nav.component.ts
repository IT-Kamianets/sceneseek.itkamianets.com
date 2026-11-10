import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';

@Component({
	selector: 'app-bottom-nav',
	imports: [RouterLink, RouterLinkActive],
	templateUrl: './bottom-nav.component.html',
	styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
	private readonly _authPrompt = inject(AuthPromptService);

	protected promptForSignIn(reason: 'history' | 'saved') {
		this._authPrompt.open(reason);
	}
}
