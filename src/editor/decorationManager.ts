import * as vscode from 'vscode';

export class DecorationManager {
	constructor(
		private readonly createDecoration = vscode.window.createTextEditorDecorationType
	) {}

	private readonly decorations =
		new Map<string, vscode.TextEditorDecorationType>();

	applySourceCoverage(
		editor: vscode.TextEditor,
		sourceId: string,
		color: string,
		coveredLines: number[]
	): void {
		let decoration = this.decorations.get(sourceId);

		if (!decoration) {
			decoration =
				this.createDecoration({
					backgroundColor: color
				});

			this.decorations.set(
				sourceId,
				decoration
			);
		}

		const ranges: vscode.Range[] = [];

		for (const coverageLine of coveredLines) {
			if (!Number.isSafeInteger(coverageLine) || coverageLine <= 0) {
				continue;
			}

			const editorLine = coverageLine - 1;

			if (
				editorLine < 0 ||
				editorLine >= editor.document.lineCount
			) {
				continue;
			}

			const line =
				editor.document.lineAt(editorLine);

			ranges.push(
				new vscode.Range(
					line.range.start,
					line.range.end
				)
			);
		}

		editor.setDecorations(
			decoration,
			ranges
		);
	}

	clear(editor: vscode.TextEditor): void {
		for (const decoration of this.decorations.values()) {
			editor.setDecorations(
				decoration,
				[]
			);
		}
	}

	/** Disposing removes this type from every editor, including hidden documents. */
	retainSources(sourceIds: readonly string[]): void {
		const retained = new Set(sourceIds);
		for (const [id, decoration] of this.decorations) {
			if (!retained.has(id)) {
				decoration.dispose();
				this.decorations.delete(id);
			}
		}
	}

	dispose(): void {
		for (const decoration of this.decorations.values()) {
			decoration.dispose();
		}

		this.decorations.clear();
	}
}
