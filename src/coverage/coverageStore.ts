import { CoverageSource } from './types';

export class CoverageStore {
	private readonly sources = new Map<string, CoverageSource>();

	add(source: CoverageSource): void {
		this.sources.set(source.id, source);
	}

	getAll(): CoverageSource[] {
		return Array.from(this.sources.values());
	}

	get(id: string): CoverageSource | undefined {
		return this.sources.get(id);
	}

	remove(id: string): void {
		this.sources.delete(id);
	}

	clear(): void {
		this.sources.clear();
	}

	get size(): number {
		return this.sources.size;
	}
}