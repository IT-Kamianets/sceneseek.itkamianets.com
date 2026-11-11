import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthPromptService } from '../../feature/auth-prompt/auth-prompt.service';

@Component({
	selector: 'app-auth-prompt',
	imports: [RouterLink],
	templateUrl: './auth-prompt.component.html',
	styleUrl: './auth-prompt.component.scss',
})
export class AuthPromptComponent {
	protected readonly prompt = inject(AuthPromptService);

	protected closeFromBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			this.prompt.close();
		}
	}
}
