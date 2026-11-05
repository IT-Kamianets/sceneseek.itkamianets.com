import { Company } from '../company/company.interface';

export interface BootstrapData {
	company?: Partial<Company> | null;
}
