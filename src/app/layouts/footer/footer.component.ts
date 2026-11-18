import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { CompanyService } from '../../feature/company/company.service';

interface FooterPageLink {
	label: string;
	path: string;
}

@Component({
	selector: 'app-footer',
	imports: [RouterLink, TranslateDirective],
	templateUrl: './footer.component.html',
})
export class FooterComponent {
	private readonly _companyService = inject(CompanyService);
	private readonly _translate = inject(TranslateService);

	protected readonly company = this._companyService.company;
	protected readonly currentYear = new Date().getFullYear();
	protected readonly pageLinks = computed<FooterPageLink[]>(() => [
		{
			label: 'Explore',
			path: '/',
		},
	]);
	protected readonly companyImage = 'sceneseek-logo.jpg';
	protected readonly companyImageAlt = computed(() =>
		this.company().name ? this.company().name : 'Company image',
	);
	protected translateText(text: string): string {
		return this._translate.translate(text)();
	}
}
