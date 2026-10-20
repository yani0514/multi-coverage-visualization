import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';

export class MarkerManager {
	private readonly decorations =
		new Map<string, vscode.TextEditorDecorationType>();

	applyMarkers(
		editor: vscode.TextEditor,
		fileCoverage: Map<number, CoverageSource[]>
	): void {
		this.clear(editor);

		const groupedMarkers =
			new Map<
				string,
				{
					sources: CoverageSource[];
					options: vscode.DecorationOptions[];
				}
			>();

		for (const [lineNumber, sources] of fileCoverage) {
			// Markers are only needed for overlapping coverage.
			if (sources.length <= 1) {
				continue;
			}

			if (lineNumber <= 0) {
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

			const sortedSources = [...sources].sort(
				(a, b) => a.id.localeCompare(b.id)
			);

			const combinationKey =
				sortedSources
					.map(source => source.id)
					.join('|');

			let group =
				groupedMarkers.get(combinationKey);

			if (!group) {
				group = {
					sources: sortedSources,
					options: []
				};

				groupedMarkers.set(
					combinationKey,
					group
				);
			}

			const hoverMessage =
				this.createHoverMessage(sortedSources);

			group.options.push({
				range: new vscode.Range(
					line.range.end,
					line.range.end
				),
				hoverMessage
			});
		}

		// Apply each coverage combination ONCE
		// with all matching lines.
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
	}

	private getOrCreateDecoration(
		key: string,
		sources: CoverageSource[]
	): vscode.TextEditorDecorationType {
		const existing =
			this.decorations.get(key);

		if (existing) {
			return existing;
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
			vscode.window.createTextEditorDecorationType({
				after: {
					contentIconPath: iconUri,
					margin: '0 0 0 0.45em',
					width: `${this.getIconWidth(sources.length)}px`,
					height: '10px'
				}
			});

		this.decorations.set(
			key,
			decoration
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
			markdown.appendMarkdown(
				`- **${source.name}**\n`
			);
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
		for (
			const decoration
			of this.decorations.values()
		) {
			editor.setDecorations(
				decoration,
				[]
			);
		}
	}

	dispose(): void {
		for (
			const decoration
			of this.decorations.values()
		) {
			decoration.dispose();
		}

		this.decorations.clear();
	}
}