import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

import { CoverageStore } from '../coverage/coverageStore';
import { CoverageQuery } from '../coverage/coverageQuery';
import { ComparisonMode } from '../coverage/comparisonMode';
import { LineCoverage } from '../coverage/comparisonFilter';
import { parseCoverageFile } from '../coverage/parser';
import { CoverageSource } from '../coverage/types';
import { DecorationManager } from '../editor/decorationManager';
import { MarkerManager } from '../editor/markerManager';
import { EditorCoverageRenderer } from '../editor/editorCoverageRenderer';
import { PathResolver } from '../paths/pathResolver';

class RecordingBackgrounds extends DecorationManager {
	readonly lines = new Map<string, number[]>();
	override clear(): void { this.lines.clear(); }
	override applySourceCoverage(
		_editor: vscode.TextEditor, id: string, _color: string, lines: number[]
	): void { this.lines.set(id, lines); }
}

class RecordingMarkers extends MarkerManager {
	coverage: LineCoverage = new Map();
	override clear(): void { this.coverage = new Map(); }
	override applyMarkers(_editor: vscode.TextEditor, coverage: LineCoverage): void {
		this.coverage = coverage;
	}
}

async function openActiveFile(filename: string): Promise<void> {
	const document = await vscode.workspace.openTextDocument(filename);
	await vscode.window.showTextDocument(document);
	// The workbench can resolve showTextDocument before forwarding active-editor state.
	for (let attempt = 0; attempt < 100; attempt++) {
		if (vscode.window.activeTextEditor?.document === document) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 20));
	}
	assert.fail(`Editor did not become active: ${filename}`);
}

suite('Editor coverage pipeline', () => {
	test('comparison and source state survive switching mapped PHP and INC files', async function () {
		this.timeout(15000);
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-coverage-'));
		const backgrounds = new RecordingBackgrounds();
		const markers = new RecordingMarkers();
		try {
			const store = new CoverageStore();
			for (const [id, lines] of [['A', [1, 2, 3, 5]], ['B', [2, 3, 4, 5]]] as const) {
				const jsonPath = path.join(directory, `${id}.json`);
				await fs.writeFile(jsonPath, JSON.stringify({
					'/remote/edit.php': Object.fromEntries(lines.map(line => [line, 1])),
					'/remote/birthdays.php': { '2': 1 },
					'/remote/helper.inc': { '3': 1 }
				}));
				const source: CoverageSource = {
					id, name: `${id}.json`, filePath: jsonPath,
					color: 'rgba(29, 78, 216, 0.20)', enabled: true,
					coverage: await parseCoverageFile(jsonPath)
				};
				store.add(source);
			}
			let mode: ComparisonMode = 'shared';
			let mapping = { coverageRoot: '/remote', localRoot: directory };
			const renderer = new EditorCoverageRenderer({
				store, query: new CoverageQuery(store), pathResolver: new PathResolver(),
				decorationManager: backgrounds, markerManager: markers,
				getPathMapping: () => mapping,
				getComparisonMode: () => mode
			});
			for (const [filename, expected] of [
				['edit.php', [2, 3, 5]], ['birthdays.php', [2]], ['helper.inc', [3]]
			] as const) {
				const filenamePath = path.join(directory, filename);
				await fs.writeFile(filenamePath, 'one\ntwo\nthree\nfour\nfive\n');
				await openActiveFile(filenamePath);
				renderer.refreshActiveEditor();
				assert.deepStrictEqual([...markers.coverage.keys()], [...expected]);
				assert.deepStrictEqual(backgrounds.lines.get('A'), [...expected]);
				assert.deepStrictEqual(backgrounds.lines.get('B'), [...expected]);
			}
			await openActiveFile(path.join(directory, 'edit.php'));
			mode = 'exclusive';
			renderer.refreshActiveEditor();
			assert.deepStrictEqual([...markers.coverage.keys()].sort(), [1, 4]);
			assert.deepStrictEqual(backgrounds.lines.get('A'), [1]);
			assert.deepStrictEqual(backgrounds.lines.get('B'), [4]);
			store.toggle('B');
			renderer.refreshActiveEditor();
			assert.deepStrictEqual(backgrounds.lines.get('A'), [1, 2, 3, 5]);
			assert.strictEqual(backgrounds.lines.has('B'), false);
			mode = 'shared';
			renderer.refreshActiveEditor();
			assert.strictEqual(markers.coverage.size, 0);
			assert.strictEqual(backgrounds.lines.size, 0);
			store.setAllEnabled(true);
			mode = 'combined';
			renderer.refreshActiveEditor();
			assert.ok(backgrounds.lines.size > 0);
			mapping = { ...mapping, coverageRoot: '/incorrect' };
			renderer.refreshActiveEditor();
			assert.strictEqual(markers.coverage.size, 0);
			assert.strictEqual(backgrounds.lines.size, 0);
			mapping = { ...mapping, coverageRoot: '/remote' };
			renderer.refreshActiveEditor();
			assert.deepStrictEqual(backgrounds.lines.get('A'), [1, 2, 3, 5]);
			assert.deepStrictEqual(backgrounds.lines.get('B')?.sort((a, b) => a - b), [2, 3, 4, 5]);
			store.setAllEnabled(false);
			mode = 'combined';
			renderer.refreshActiveEditor();
			assert.strictEqual(markers.coverage.size, 0);
			assert.strictEqual(backgrounds.lines.size, 0);
		} finally {
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			backgrounds.dispose();
			markers.dispose();
			// Windows file watchers can briefly retain handles after editors close.
			await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		}
	});
});
