export const environment: {
	apiUrl: string;
	coverrApiUrl: string;
	appVersion: string;
	production: boolean;
	companyId: string;
	firebase: {
		apiKey: string;
		authDomain: string;
		projectId: string;
		appId: string;
	};
	defaultLanguage: string;
	languages: AppLanguage[];
} = {
	apiUrl: 'https://it.webart.work',
	coverrApiUrl: 'https://europe-west1-sceneseek-8719f.cloudfunctions.net/coverrSearch',
	appVersion: '1.0.0',
	production: true,
	companyId: 'demo',
	firebase: {
		apiKey: 'AIzaSyCH9VU0W_Gxmul_8wBlOSyB0EVEFZOfTRg',
		authDomain: 'sceneseek-8719f.firebaseapp.com',
		projectId: 'sceneseek-8719f',
		appId: '1:437369214201:web:791d02470c5172dfb17e28',
	},
	defaultLanguage: 'en',
	languages: [
		{ code: 'en', name: 'English', nativeName: 'English', flagSrc: 'flags/united-kingdom.svg', htmlLang: 'en', population: 280 },
		{ code: 'ua', name: 'Ukrainian', nativeName: 'Українська', flagSrc: 'flags/ukraine.svg', htmlLang: 'uk', population: 35 },
	],
};

export interface AppLanguage {
	code: string;
	name: string;
	nativeName: string;
	flagSrc: string;
	htmlLang: string;
	population: number;
}
