import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import { CompanyService } from '../../feature/company/company.service';

@Component({
	selector: 'app-topbar',
	imports: [NgOptimizedImage, RouterLink, TranslateDirective],
	templateUrl: './topbar.component.html',
	styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
	private readonly _themeService = inject(ThemeService);
	private readonly _companyService = inject(CompanyService);

	protected readonly company = this._companyService.company;
	protected readonly logoSrc = computed(() =>
		this._themeService.mode() === 'dark'
			? 'sceneseek-logo-dark.jpg'
			: 'sceneseek-logo-light.jpg',
	);

	constructor() {
		this._themeService.init();
	}
}
