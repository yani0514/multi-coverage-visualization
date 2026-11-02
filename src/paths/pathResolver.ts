import * as path from 'path';
import { PathMapping } from './pathMapping';

export class PathResolver {
	resolveLocalPath(
		coveragePath: string,
		mapping: PathMapping
	): string | undefined {
		const normalizedCoveragePath = this.normalize(coveragePath);
		const normalizedCoverageRoot = this.normalize(mapping.coverageRoot);

		if (!this.isWithinRoot(normalizedCoveragePath, normalizedCoverageRoot)) {
			return undefined;
		}

		const relativePath = normalizedCoveragePath
			.slice(normalizedCoverageRoot.length)
			.replace(/^\/+/, '');

		return path.join(
			mapping.localRoot,
			...relativePath.split('/')
		);
	}

	resolveCoveragePath(
		localFilePath: string,
		coveragePaths: string[],
		mapping: PathMapping
	): string | undefined {
		const normalizedLocal = this.normalize(localFilePath);
		const normalizedLocalRoot = this.normalize(mapping.localRoot);

		// Windows local paths are case-insensitive; VS Code normalizes drive letters.
		const windowsPath = /^[a-z]:\//i.test(normalizedLocalRoot) || normalizedLocalRoot.startsWith('//');
		const comparableLocal = windowsPath ? normalizedLocal.toLowerCase() : normalizedLocal;
		const comparableRoot = windowsPath ? normalizedLocalRoot.toLowerCase() : normalizedLocalRoot;
		if (!this.isWithinRoot(comparableLocal, comparableRoot)) {
			return undefined;
		}

		const relativePath = normalizedLocal
			.slice(normalizedLocalRoot.length)
			.replace(/^\/+/, '');

		const expectedCoveragePath = this.normalize(
			`${mapping.coverageRoot}/${relativePath}`
		);

		for (const coveragePath of coveragePaths) {
			if (this.normalize(coveragePath) === expectedCoveragePath) {
				return coveragePath;
			}
		}

		return undefined;
	}

	private isWithinRoot(filePath: string, root: string): boolean {
		return filePath === root || filePath.startsWith(`${root}/`);
	}

	private normalize(filePath: string): string {
		return filePath
			.replace(/\\/g, '/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, '');
	}
}
