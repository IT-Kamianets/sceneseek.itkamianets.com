import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
	templateUrl: './section.component.html',
})
export class SectionComponent {
	protected readonly pageTitle = inject(ActivatedRoute).snapshot.data['pageTitle'] as string;
}
