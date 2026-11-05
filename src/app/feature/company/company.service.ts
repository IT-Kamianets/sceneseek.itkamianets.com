import { Service, signal } from '@angular/core';
import { COMPANY_FALLBACK, EMPTY_COMPANY } from './company.const';
import { Company, CompanyProfile } from './company.interface';

@Service()
export class CompanyService {
	readonly company = signal<CompanyProfile>(COMPANY_FALLBACK);
	readonly loading = signal(true);

	setFallbackCompany(company: CompanyProfile) {
		this.company.set(company);
	}

	setCompany(company: Partial<Company> | null | undefined) {
		if (!company) {
			return;
		}

		this.company.update((currentCompany) => ({
			...currentCompany,
			_id: _stringOrFallback(company._id, currentCompany._id),
			name: _stringOrFallback(company.name, currentCompany.name),
			title: _stringOrFallback(company.title, currentCompany.title),
			description: _stringOrFallback(company.description, currentCompany.description),
			image: _stringOrFallback(company.image, currentCompany.image),
			siteUrl: _stringOrFallback(company.siteUrl, currentCompany.siteUrl),
			custom: company.custom ?? currentCompany.custom,
		}));
	}

	reset() {
		this.company.set(EMPTY_COMPANY);
		this.loading.set(true);
	}
}

function _stringOrFallback(value: string | null | undefined, fallback: string): string {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}
