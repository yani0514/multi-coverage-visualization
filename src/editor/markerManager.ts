import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';

export interface MarkerOptions {
	readonly showSingleSourceMarkers?: boolean;
}

export class MarkerManager {
	private static readonly historicalCacheLimit = 256;
	private readonly editorCombinations = new WeakMap<vscode.TextEditor, Set<string>>();
	constructor(
		private readonly createDecoration = vscode.window.createTextEditorDecorationType
	) {}

	private readonly decorations =
		new Map<string, {
			decoration: vscode.TextEditorDecorationType;
			sourceIds: readonly string[];
		}>();

	applyMarkers(
		editor: vscode.TextEditor,
		fileCoverage: Map<number, CoverageSource[]>,
		options: MarkerOptions = {}
	): void {
		this.clear(editor);

		const groupedMarkers =
			new Map<
				string,
				{
					sources: CoverageSource[];
					options: vscode.DecorationOptions[];
					hover: vscode.MarkdownString;
				}
			>();
		// CoverageQuery emits the same contributor order on many lines. Sort each
		// ordered sequence once per refresh, while retaining canonical grouping.
		const combinations = new Map<string, { key: string; sources: CoverageSource[] }>();

		for (const [lineNumber, sources] of fileCoverage) {
			// Exclusive comparison also uses markers to identify the sole owner.
			if (sources.length === 0 || (sources.length === 1 && !options.showSingleSourceMarkers)) {
				continue;
			}

			if (!Number.isSafeInteger(lineNumber) || lineNumber <= 0) {
				continue;
			}

			const editorLine = lineNumber - 1;

			if (
				editorLine < 0 ||
				editorLine >= editor.document.lineCount
			) {
				continue;
			}

			const line =
				editor.document.lineAt(editorLine);

			const orderedKey = JSON.stringify(sources.map(source => source.id));
			let combination = combinations.get(orderedKey);
			if (!combination) {
				const sorted = [...sources].sort((a, b) => a.id.localeCompare(b.id));
				combination = { key: JSON.stringify(sorted.map(source => source.id)), sources: sorted };
				combinations.set(orderedKey, combination);
			}
			const sortedSources = combination.sources;
			const combinationKey = combination.key;

			let group =
				groupedMarkers.get(combinationKey);

			if (!group) {
				group = {
					sources: sortedSources,
					options: [],
					hover: this.createHoverMessage(sortedSources)
				};

				groupedMarkers.set(
					combinationKey,
					group
				);
			}

			group.options.push({
				range: new vscode.Range(
					line.range.end,
					line.range.end
				),
				hoverMessage: group.hover
			});
		}

		// Apply each coverage combination ONCE
		// with all matching lines.
		this.editorCombinations.set(editor, new Set(groupedMarkers.keys()));
		for (
			const [key, group]
			of groupedMarkers
		) {
			const decoration =
				this.getOrCreateDecoration(
					key,
					group.sources
				);

			editor.setDecorations(
				decoration,
				group.options
			);
		}
		this.pruneHistoricalCombinations(editor);
	}

	private getOrCreateDecoration(
		key: string,
		sources: CoverageSource[]
	): vscode.TextEditorDecorationType {
		const existing =
			this.decorations.get(key);

		if (existing) {
			// Move a reused entry to the end for least-recently-used pruning.
			this.decorations.delete(key);
			this.decorations.set(key, existing);
			return existing.decoration;
		}

		const svg =
			this.createMarkerSvg(sources);

		const encodedSvg =
			encodeURIComponent(svg);

		const iconUri =
			vscode.Uri.parse(
				`data:image/svg+xml,${encodedSvg}`
			);

		const decoration =
			this.createDecoration({
				after: {
					contentIconPath: iconUri,
					margin: '0 0 0 0.45em',
					width: `${this.getIconWidth(sources.length)}px`,
					height: '10px'
				}
			});

		this.decorations.set(
			key,
			{ decoration, sourceIds: sources.map(source => source.id) }
		);

		return decoration;
	}

	private createMarkerSvg(
		sources: CoverageSource[]
	): string {
		const markerSize = 6;
		const gap = 2;

		const width =
			sources.length * markerSize +
			(sources.length - 1) * gap;

		const circles =
			sources
				.map((source, index) => {
					const cx =
						index * (markerSize + gap) +
						markerSize / 2;

					const color =
						this.toSolidColor(
							source.color
						);

					return `
						<circle
							cx="${cx}"
							cy="5"
							r="3"
							fill="${color}"
						/>
					`;
				})
				.join('');

		return `
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="${width}"
				height="10"
				viewBox="0 0 ${width} 10"
			>
				${circles}
			</svg>
		`;
	}

	private getIconWidth(
		sourceCount: number
	): number {
		const markerSize = 6;
		const gap = 2;

		return (
			sourceCount * markerSize +
			(sourceCount - 1) * gap
		);
	}

	private createHoverMessage(
		sources: CoverageSource[]
	): vscode.MarkdownString {
		const markdown =
			new vscode.MarkdownString();

		markdown.appendMarkdown(
			`**Covered by ${sources.length} coverage source${sources.length === 1 ? '' : 's'}:**\n\n`
		);

		for (const source of sources) {
			markdown.appendMarkdown('- ');
			markdown.appendText(source.name);
			markdown.appendMarkdown('\n');
		}

		return markdown;
	}

	private toSolidColor(
		color: string
	): string {
		return color.replace(
			/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
			'rgb($1,$2,$3)'
		);
	}

	clear(
		editor: vscode.TextEditor
	): void {
		const keys = this.editorCombinations.get(editor);
		this.editorCombinations.delete(editor);
		for (const key of keys ?? []) {
			const entry = this.decorations.get(key);
			if (entry) { editor.setDecorations(entry.decoration, []); }
		}
	}

	/** Also called after display-off/closed-editor refreshes, where no markers apply. */
	pruneUnusedCombinations(): void {
		this.pruneHistoricalCombinations(vscode.window.activeTextEditor);
	}

	private pruneHistoricalCombinations(currentEditor?: vscode.TextEditor): void {
		if (this.decorations.size <= MarkerManager.historicalCacheLimit) {
			return;
		}
		const visibleKeys = new Set<string>();
		const editors = currentEditor ? [...vscode.window.visibleTextEditors, currentEditor] : vscode.window.visibleTextEditors;
		for (const editor of editors) {
			for (const key of this.editorCombinations.get(editor) ?? []) {
				visibleKeys.add(key);
			}
		}
		for (const [key, entry] of this.decorations) {
			if (this.decorations.size <= MarkerManager.historicalCacheLimit) { break; }
			if (!visibleKeys.has(key)) {
				entry.decoration.dispose();
				this.decorations.delete(key);
			}
		}
	}

	/** Retain reusable combinations only while all their sources are still loaded. */
	retainSources(sourceIds: readonly string[]): void {
		const retained = new Set(sourceIds);
		for (const [key, entry] of this.decorations) {
			if (entry.sourceIds.some(id => !retained.has(id))) {
				entry.decoration.dispose();
				this.decorations.delete(key);
			}
		}
	}

	dispose(): void {
		for (
			const { decoration }
			of this.decorations.values()
		) {
			decoration.dispose();
		}

		this.decorations.clear();
	}
}
