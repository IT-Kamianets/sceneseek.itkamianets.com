export interface Company {
	_id: string;
	name: string;
	title: string;
	description: string;
	image: string;
	siteUrl: string;
	custom?: Record<string, unknown>;
}

export interface CompanyCurrency {
	code: string;
	icon: string;
}

export interface SeoMetadata {
	title: string;
	description: string;
	keywords: string[];
	author: string;
	robots: string;
	image: string;
	type: string;
	twitterCard: string;
}

export interface SeoPageOverride extends Partial<SeoMetadata> {
	canonicalPath?: string;
	titleSuffix?: string;
}

export interface CompanyStructuredData {
	type: string;
	priceRange: string;
	servesCuisine: string;
	addressLocality: string;
	addressCountry: string;
	sameAs: string[];
	custom?: Record<string, unknown>;
}

export interface CompanyProfile extends Company {
	lang: string;
	locale: string;
	logo: string;
	phone: string;
	email: string;
	address: string;
	currency: CompanyCurrency;
	defaultSeo: SeoMetadata;
	pageSeo: Record<string, SeoPageOverride>;
	structuredData: CompanyStructuredData;
}
