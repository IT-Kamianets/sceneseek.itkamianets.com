import { Routes } from '@angular/router';
import { buildRouteMeta } from '@wawjs/ngx-default';
import { companyProfile } from './feature/company/company.data';

const sectionRoute = (path: string, title: string) => ({
	path,
	data: {
		pageTitle: title,
		meta: {
			...buildRouteMeta(companyProfile, path ? `/${path}` : '/'),
			title: `${title} | SceneSeek`,
			titleSuffix: '',
		},
	},
	loadComponent: () =>
		import('./pages/section/section.component').then((module) => module.SectionComponent),
});

const authRoute = (
	path: string,
	mode: 'login' | 'register' | 'reset',
	title: string,
	description: string,
) => ({
	path,
	data: {
		pageTitle: title,
		authMode: mode,
		meta: {
			...buildRouteMeta(companyProfile, `/auth/${path}`),
			title: `${title} | SceneSeek`,
			titleSuffix: '',
			description,
			robots: 'noindex, nofollow',
		},
	},
	loadComponent: () =>
		import('./pages/auth/auth.component').then((module) => module.AuthComponent),
});

export const routes: Routes = [
	{
		...sectionRoute('', 'Головна'),
		loadComponent: () =>
			import('./pages/landing/landing.component').then((module) => module.LandingComponent),
	},
	sectionRoute('history', 'Історія'),
	{
		...sectionRoute('saved', 'Збережене'),
		loadComponent: () =>
			import('./pages/saved/saved.component').then((module) => module.SavedComponent),
	},
	{
		...sectionRoute('profile', 'Профіль'),
		loadComponent: () =>
			import('./pages/profile/profile.component').then((module) => module.ProfileComponent),
	},
	{
		path: 'auth',
		children: [
			authRoute('login', 'login', 'Вхід', 'Увійдіть до акаунта SceneSeek.'),
			authRoute('register', 'register', 'Створення акаунта', 'Створіть акаунт SceneSeek для власних добірок відеосцен.'),
			authRoute('forgot-password', 'reset', 'Відновлення пароля', 'Відновіть доступ до свого акаунта SceneSeek.'),
		],
	},
	{
		path: '**',
		redirectTo: '',
	},
];
