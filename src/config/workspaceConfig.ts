import type { Memento } from 'vscode';
import * as path from 'path';
import { ComparisonMode, DEFAULT_COMPARISON_MODE, isComparisonMode } from '../coverage/comparisonMode';
import { PathMapping } from '../paths/pathMapping';
import { DisplayOptions, restoreDisplayOptions } from '../editor/displayOptions';

const MAPPING_KEY = 'multiCoverage.pathMapping';
const COMPARISON_KEY = 'multiCoverage.comparisonMode';
const DISPLAY_KEY = 'multiCoverage.displayOptions';

export function isAbsoluteCoverageRoot(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0 && !value.includes('\0') &&
		(path.posix.isAbsolute(value) || /^[a-z]:[\\/]/i.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value));
}

function isPathMapping(value: unknown): value is PathMapping {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const mapping = value as Record<string, unknown>;
	return isAbsoluteCoverageRoot(mapping.coverageRoot) &&
		typeof mapping.localRoot === 'string' &&
		!mapping.localRoot.includes('\0') && path.isAbsolute(mapping.localRoot);
}

/** Only configuration is stored; coverage data and loaded-file lists stay in memory. */
export class WorkspaceConfig {
	constructor(private readonly state: Pick<Memento, 'get' | 'update'>) {}

	getPathMapping(): PathMapping | undefined {
		const value = this.state.get<unknown>(MAPPING_KEY);
		return isPathMapping(value)
			? { coverageRoot: value.coverageRoot, localRoot: value.localRoot }
			: undefined;
	}

	async savePathMapping(mapping: PathMapping): Promise<void> {
		if (!isPathMapping(mapping)) {
			throw new Error('Path mapping must contain absolute coverage and local roots.');
		}
		await this.state.update(MAPPING_KEY, {
			coverageRoot: mapping.coverageRoot, localRoot: mapping.localRoot
		});
	}

	getComparisonMode(): ComparisonMode {
		const value = this.state.get<unknown>(COMPARISON_KEY);
		return isComparisonMode(value) ? value : DEFAULT_COMPARISON_MODE;
	}

	async saveComparisonMode(mode: ComparisonMode): Promise<void> {
		if (!isComparisonMode(mode)) {
			throw new Error('Unknown comparison mode.');
		}
		await this.state.update(COMPARISON_KEY, mode);
	}

	getDisplayOptions(): DisplayOptions {
		return restoreDisplayOptions(this.state.get<unknown>(DISPLAY_KEY));
	}

	async saveDisplayOptions(options: DisplayOptions): Promise<void> {
		if (typeof options.backgroundHighlights !== 'boolean' || typeof options.coverageMarkers !== 'boolean') {
			throw new Error('Display options must be boolean values.');
		}
		await this.state.update(DISPLAY_KEY, { ...options });
	}
}
