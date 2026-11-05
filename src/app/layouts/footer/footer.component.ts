import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
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

	protected readonly company = this._companyService.company;
	protected readonly currentYear = new Date().getFullYear();
	protected readonly pageLinks = computed<FooterPageLink[]>(() => [
		{
			label: 'Landing',
			path: '/',
		},
	]);
	protected readonly companyImage = computed(() => this.company().image || 'logo.png');
	protected readonly companyImageAlt = computed(() =>
		this.company().name ? this.company().name : 'Company image',
	);
}
