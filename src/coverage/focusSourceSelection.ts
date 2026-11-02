import { CoverageStore } from './coverageStore';

/** Session state: only a currently loaded, enabled run can remain focused. */
export class FocusSourceSelection {
	private sourceId: string | undefined;
	constructor(private readonly store: CoverageStore) {}

	getSourceId(): string | undefined {
		if (this.sourceId !== undefined && !this.store.get(this.sourceId)?.enabled) {
			this.sourceId = undefined;
		}
		return this.sourceId;
	}

	select(sourceId: string | undefined): void {
		if (sourceId === undefined || this.store.get(sourceId)?.enabled) {
			this.sourceId = sourceId;
		}
	}
}
