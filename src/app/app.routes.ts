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

export const routes: Routes = [
	sectionRoute('', 'Головна'),
	sectionRoute('history', 'Історія'),
	sectionRoute('saved', 'Збережене'),
	sectionRoute('profile', 'Профіль / акаунт'),
	{
		path: '**',
		redirectTo: '',
	},
];
