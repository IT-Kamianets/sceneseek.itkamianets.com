import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

@Component({
	selector: 'app-agent',
	imports: [TranslateDirective],
	templateUrl: './agent.component.html',
	styleUrl: './agent.component.scss',
})
export class AgentComponent {}
