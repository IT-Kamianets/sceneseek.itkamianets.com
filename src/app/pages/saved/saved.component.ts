import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirebaseAuthService } from '../../feature/firebase-auth/firebase-auth.service';
import { SavedScenesService } from '../../feature/saved-scenes/saved-scenes.service';

@Component({
	selector: 'app-saved',
	imports: [RouterLink],
	templateUrl: './saved.component.html',
	styleUrl: './saved.component.scss',
})
export class SavedComponent {
	protected readonly auth = inject(FirebaseAuthService);
	protected readonly saved = inject(SavedScenesService);

	constructor() {
		void this.saved.load().catch(() => undefined);
	}

	protected async remove(id: string) {
		const scene = this.saved.scenes().find((item) => item.id === id);
		if (!scene) {
			return;
		}
		try {
			await this.saved.toggle(scene);
		} catch {
			// The service provides the user-facing error message.
		}
	}
}
