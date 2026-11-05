import { companyProfile } from './company.data';
import { CompanyProfile } from './company.interface';

export const EMPTY_COMPANY: CompanyProfile = {
	_id: '',
	name: '',
	title: '',
	description: '',
	image: '',
	siteUrl: '',
	lang: '',
	locale: '',
	logo: '',
	phone: '',
	email: '',
	address: '',
	currency: {
		code: '',
		icon: '',
	},
	defaultSeo: {
		title: '',
		description: '',
		keywords: [],
		author: '',
		robots: '',
		image: '',
		type: '',
		twitterCard: '',
	},
	pageSeo: {},
	structuredData: {
		type: '',
		priceRange: '',
		servesCuisine: '',
		addressLocality: '',
		addressCountry: '',
		sameAs: [],
	},
};

export const COMPANY_FALLBACK = companyProfile;
