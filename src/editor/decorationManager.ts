import * as vscode from 'vscode';

export class DecorationManager {
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
				vscode.window.createTextEditorDecorationType({
					backgroundColor: color
				});

			this.decorations.set(
				sourceId,
				decoration
			);
		}

		const ranges: vscode.Range[] = [];

		for (const coverageLine of coveredLines) {
			if (coverageLine <= 0) {
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

	dispose(): void {
		for (const decoration of this.decorations.values()) {
			decoration.dispose();
		}

		this.decorations.clear();
	}
}