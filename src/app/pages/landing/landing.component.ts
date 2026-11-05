import { Component, computed, inject } from '@angular/core';
import { TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { CompanyService } from '../../feature/company/company.service';

@Component({
	imports: [TranslateDirective],
	templateUrl: './landing.component.html',
	styleUrl: './landing.component.scss',
})
export class LandingComponent {
	private readonly _translateService = inject(TranslateService);

	protected readonly company = inject(CompanyService).company;
	protected readonly companyDescription = computed(() =>
		this._translateService.translate(this.company().description)(),
	);
}
