import { CoverageStore } from './coverageStore';

export const PAIRWISE_OPERATIONS = [
	{ operation: 'both', label: 'Both', description: 'Lines covered by A and B.' },
	{ operation: 'only-a', label: 'Only A', description: 'Lines covered by A but not B.' },
	{ operation: 'only-b', label: 'Only B', description: 'Lines covered by B but not A.' },
	{ operation: 'either', label: 'A or B', description: 'Lines covered by A, B, or both.' }
] as const;
export type PairwiseOperation = typeof PAIRWISE_OPERATIONS[number]['operation'];
export type MultiplicityRule = 'at-least' | 'exactly';
export type AdvancedSelection =
	| { kind: 'standard' }
	| { kind: 'pairwise'; sourceA: string; sourceB: string; operation: PairwiseOperation }
	| { kind: 'multiplicity'; rule: MultiplicityRule; count: number };

export function isPairwiseOperation(value: unknown): value is PairwiseOperation {
	return PAIRWISE_OPERATIONS.some(item => item.operation === value);
}

export function isValidMultiplicity(count: number, enabledCount: number): boolean {
	return Number.isSafeInteger(count) && count >= 1 && count <= enabledCount;
}

/** Advanced analyses are alternatives to standard comparison, never stacked filters. */
export class AdvancedComparison {
	private selection: AdvancedSelection = { kind: 'standard' };
	constructor(private readonly store: CoverageStore) {}

	getSelection(): AdvancedSelection {
		const current = this.selection;
		if (current.kind === 'pairwise' &&
			(!this.store.get(current.sourceA)?.enabled || !this.store.get(current.sourceB)?.enabled)) {
			this.reset();
		}
		if (current.kind === 'multiplicity' && !isValidMultiplicity(current.count, this.enabledCount())) {
			this.reset();
		}
		return { ...this.selection };
	}

	setPairwise(sourceA: string, sourceB: string, operation: PairwiseOperation = 'both'): boolean {
		if (sourceA === sourceB || !this.store.get(sourceA)?.enabled || !this.store.get(sourceB)?.enabled || !isPairwiseOperation(operation)) {
			return false;
		}
		this.selection = { kind: 'pairwise', sourceA, sourceB, operation };
		return true;
	}

	setPairwiseOperation(operation: PairwiseOperation): void {
		const current = this.getSelection();
		if (current.kind === 'pairwise' && isPairwiseOperation(operation)) {
			this.selection = { ...current, operation };
		}
	}

	setMultiplicity(rule: MultiplicityRule, count: number): boolean {
		if ((rule !== 'at-least' && rule !== 'exactly') || !isValidMultiplicity(count, this.enabledCount())) {
			return false;
		}
		this.selection = { kind: 'multiplicity', rule, count };
		return true;
	}

	reset(): void { this.selection = { kind: 'standard' }; }
	private enabledCount(): number { return this.store.getAll().filter(source => source.enabled).length; }
}
