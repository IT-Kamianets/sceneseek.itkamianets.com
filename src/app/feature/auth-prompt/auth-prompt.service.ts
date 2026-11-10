import { Service, signal } from '@angular/core';

export type AuthPromptReason = 'history' | 'saved';

@Service()
export class AuthPromptService {
	readonly isOpen = signal(false);
	readonly reason = signal<AuthPromptReason>('saved');

	open(reason: AuthPromptReason) {
		this.reason.set(reason);
		this.isOpen.set(true);
	}

	close() {
		this.isOpen.set(false);
	}
}
