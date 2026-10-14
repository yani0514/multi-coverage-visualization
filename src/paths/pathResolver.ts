import * as path from 'path';
import { PathMapping } from './pathMapping';

export class PathResolver {
	resolveLocalPath(
		coveragePath: string,
		mapping: PathMapping
	): string | undefined {
		const normalizedCoveragePath = this.normalize(coveragePath);
		const normalizedCoverageRoot = this.normalize(mapping.coverageRoot);

		if (!normalizedCoveragePath.startsWith(normalizedCoverageRoot)) {
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

		if (!normalizedLocal.startsWith(normalizedLocalRoot)) {
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

	private normalize(filePath: string): string {
		return filePath
			.replace(/\\/g, '/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, '');
	}
}