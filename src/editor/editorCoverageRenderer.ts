import * as vscode from 'vscode';

import { ComparisonMode } from '../coverage/comparisonMode';
import {
	buildVisibleCoverage,
	LineCoverage
} from '../coverage/comparisonFilter';
import { CoverageQuery } from '../coverage/coverageQuery';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageSource } from '../coverage/types';

import { PathMapping } from '../paths/pathMapping';
import { PathResolver } from '../paths/pathResolver';

import { DecorationManager } from './decorationManager';
import { MarkerManager } from './markerManager';

export interface EditorCoverageRendererOptions {
	readonly store: CoverageStore;
	readonly query: CoverageQuery;
	readonly pathResolver: PathResolver;
	readonly decorationManager: DecorationManager;
	readonly markerManager: MarkerManager;
	readonly getPathMapping: () =>
		| PathMapping
		| undefined;
	readonly getComparisonMode: () =>
		ComparisonMode;
}

export class EditorCoverageRenderer {
	constructor(
		private readonly options: EditorCoverageRendererOptions
	) {}

	refreshActiveEditor(): void {
		const editor =
			vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		/*
		 * Always clear old decorations first so switching
		 * files, filtering, or disabling sources never leaves
		 * stale highlights behind.
		 */
		this.clearEditor(editor);

		const pathMapping =
			this.options.getPathMapping();

		if (!pathMapping) {
			return;
		}

		const localPath =
			editor.document.uri.fsPath;

		const matchedCoveragePath =
			this.options.pathResolver.resolveCoveragePath(
				localPath,
				this.getAllCoveragePaths(),
				pathMapping
			);

		if (!matchedCoveragePath) {
			return;
		}

		const fileCoverage =
			this.options.query.getCoverageForFile(
				matchedCoveragePath
			);

		const visibleCoverage =
			buildVisibleCoverage(
				fileCoverage,
				this.options.getComparisonMode()
			);

		this.applyBackgroundHighlights(
			editor,
			visibleCoverage
		);

		this.options.markerManager.applyMarkers(
			editor,
			visibleCoverage
		);
	}

	private clearEditor(
		editor: vscode.TextEditor
	): void {
		this.options.decorationManager.clear(
			editor
		);

		this.options.markerManager.clear(
			editor
		);
	}

	private applyBackgroundHighlights(
		editor: vscode.TextEditor,
		fileCoverage: LineCoverage
	): void {
		const linesBySource =
			new Map<
				string,
				{
					source: CoverageSource;
					lines: number[];
				}
			>();

		for (
			const [line, sources]
			of fileCoverage
		) {
			for (
				const source of sources
			) {
				let entry =
					linesBySource.get(
						source.id
					);

				if (!entry) {
					entry = {
						source,
						lines: []
					};

					linesBySource.set(
						source.id,
						entry
					);
				}

				entry.lines.push(line);
			}
		}

		for (
			const { source, lines }
			of linesBySource.values()
		) {
			this.options.decorationManager.applySourceCoverage(
				editor,
				source.id,
				source.color,
				lines
			);
		}
	}

	private getAllCoveragePaths(): string[] {
		const paths = new Set<string>();

		for (
			const source
			of this.options.store.getAll()
		) {
			for (
				const coveragePath
				of source.coverage.keys()
			) {
				paths.add(coveragePath);
			}
		}

		return Array.from(paths);
	}
}
