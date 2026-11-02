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
import { analyzeCurrentFile } from '../coverage/coverageAnalysis';
import { CurrentFileTreeProvider } from '../sidebar/currentFileTreeProvider';
import { FocusSourceSelection } from '../coverage/focusSourceSelection';
import { DisplayOptions, DEFAULT_DISPLAY_OPTIONS } from '../editor/displayOptions';
import { buildVisibleCoverage } from '../coverage/comparisonFilter';
import { AdvancedComparison } from '../coverage/advancedComparison';

class RecordingBackgrounds extends DecorationManager {
	readonly lines = new Map<string, number[]>();
	readonly clearedEditors = new Set<string>();
	override clear(editor: vscode.TextEditor): void {
		this.lines.clear();
		this.clearedEditors.add(editor.document.uri.toString());
	}
	override applySourceCoverage(
		_editor: vscode.TextEditor, id: string, _color: string, lines: number[]
	): void { this.lines.set(id, lines); }
}

class RecordingMarkers extends MarkerManager {
	coverage: LineCoverage = new Map();
	readonly clearedEditors = new Set<string>();
	override clear(editor: vscode.TextEditor): void {
		this.coverage = new Map();
		this.clearedEditors.add(editor.document.uri.toString());
	}
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
	test('virtual documents sharing a mapped fsPath do not receive coverage or stale statistics', async function () {
		this.timeout(10000);
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-virtual-'));
		const filename = path.join(directory, 'edit.php');
		const backgrounds = new RecordingBackgrounds();
		const markers = new RecordingMarkers();
		const virtualProvider = vscode.workspace.registerTextDocumentContentProvider('coverage-audit', {
			provideTextDocumentContent: () => 'virtual source\n'
		});
		try {
			await fs.writeFile(filename, 'real source\n');
			const store = new CoverageStore();
			store.add({
				id: 'A', name: 'A.json', filePath: path.join(directory, 'A.json'),
				color: 'rgba(29, 78, 216, 0.20)', enabled: true,
				coverage: new Map([['/remote/edit.php', new Set([1])]])
			});
			const mapping = { coverageRoot: '/remote', localRoot: directory };
			const pathResolver = new PathResolver();
			const renderer = new EditorCoverageRenderer({
				store, query: new CoverageQuery(store), pathResolver,
				decorationManager: backgrounds, markerManager: markers,
				getPathMapping: () => mapping, getComparisonMode: () => 'combined'
			});
			await openActiveFile(filename);
			assert.strictEqual(renderer.refreshActiveEditor().state, 'mapped');
			assert.deepStrictEqual(backgrounds.lines.get('A'), [1]);
			const virtualUri = vscode.Uri.file(filename).with({ scheme: 'coverage-audit' });
			assert.strictEqual(pathResolver.resolveCoveragePath(virtualUri.fsPath, ['/remote/edit.php'], mapping), '/remote/edit.php');
			const virtual = await vscode.workspace.openTextDocument(virtualUri);
			await vscode.window.showTextDocument(virtual);
			for (let attempt = 0; attempt < 100 && vscode.window.activeTextEditor?.document !== virtual; attempt++) {
				await new Promise(resolve => setTimeout(resolve, 20));
			}
			assert.strictEqual(vscode.window.activeTextEditor?.document, virtual);
			const snapshot = renderer.refreshActiveEditor();
			assert.strictEqual(snapshot.state, 'unmapped');
			assert.strictEqual(analyzeCurrentFile(snapshot).state, 'unmapped');
			assert.strictEqual(backgrounds.lines.size, 0);
			assert.strictEqual(markers.coverage.size, 0);
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			for (let attempt = 0; attempt < 100 && vscode.window.activeTextEditor; attempt++) {
				await new Promise(resolve => setTimeout(resolve, 20));
			}
			assert.deepStrictEqual(renderer.refreshActiveEditor(), { state: 'no-editor' });
		} finally {
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			virtualProvider.dispose();
			backgrounds.dispose();
			markers.dispose();
			await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		}
	});

	test('comparison and source state survive switching mapped PHP and INC files', async function () {
		this.timeout(15000);
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-coverage-'));
		const backgrounds = new RecordingBackgrounds();
		const markers = new RecordingMarkers();
		const currentFile = new CurrentFileTreeProvider();
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
			let display: DisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
			const focus = new FocusSourceSelection(store);
			const advanced = new AdvancedComparison(store);
			let mapping = { coverageRoot: '/remote', localRoot: directory };
			const renderer = new EditorCoverageRenderer({
				store, query: new CoverageQuery(store), pathResolver: new PathResolver(),
				decorationManager: backgrounds, markerManager: markers,
				getPathMapping: () => mapping,
				getComparisonMode: () => mode,
				getFocusSourceId: () => focus.getSourceId(),
				getDisplayOptions: () => display,
				getAdvancedSelection: () => advanced.getSelection()
			});
			for (const [filename, expected] of [
				['edit.php', [2, 3, 5]], ['birthdays.php', [2]], ['helper.inc', [3]]
			] as const) {
				const filenamePath = path.join(directory, filename);
				await fs.writeFile(filenamePath, 'one\ntwo\nthree\nfour\nfive\n');
				await openActiveFile(filenamePath);
				const snapshot = renderer.refreshActiveEditor();
				assert.strictEqual(snapshot.state, 'mapped');
				if (snapshot.state !== 'mapped') { assert.fail('Expected mapped coverage'); }
				assert.strictEqual(snapshot.coveragePath, `/remote/${filename}`);
				const stats = analyzeCurrentFile(snapshot);
				currentFile.update(stats);
				assert.strictEqual(currentFile.getChildren()[0].label, filename);
				if (stats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
				assert.strictEqual(stats.shared, expected.length);
				assert.strictEqual(stats.combined, filename === 'edit.php' ? 5 : 1);
				assert.deepStrictEqual([...markers.coverage.keys()], [...expected]);
				assert.deepStrictEqual(backgrounds.lines.get('A'), [...expected]);
				assert.deepStrictEqual(backgrounds.lines.get('B'), [...expected]);
			}
			await openActiveFile(path.join(directory, 'edit.php'));
			focus.select('A');
			mode = 'exclusive';
			advanced.setPairwise('A', 'B', 'both');
			let advancedStats = analyzeCurrentFile(renderer.refreshActiveEditor());
			assert.deepStrictEqual(backgrounds.lines.get('A'), [2, 3, 5]);
			assert.deepStrictEqual(backgrounds.lines.get('B'), [2, 3, 5]);
			assert.deepStrictEqual(markers.coverage.get(2)?.map(source => source.id), ['A', 'B']);
			if (advancedStats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
			assert.deepStrictEqual([advancedStats.combined, advancedStats.shared, advancedStats.exclusive], [5, 3, 2]);
			advanced.setPairwiseOperation('only-b');
			renderer.refreshActiveEditor();
			assert.deepStrictEqual(backgrounds.lines.get('B'), [4]);
			assert.strictEqual(backgrounds.lines.has('A'), false);
			await openActiveFile(path.join(directory, 'birthdays.php'));
			renderer.refreshActiveEditor();
			assert.strictEqual(backgrounds.lines.size, 0);
			advanced.setPairwiseOperation('both');
			renderer.refreshActiveEditor();
			assert.deepStrictEqual([...markers.coverage.keys()], [2]);
			mapping = { ...mapping, coverageRoot: '/wrong' };
			assert.strictEqual(renderer.refreshActiveEditor().state, 'unmapped');
			assert.strictEqual(backgrounds.lines.size, 0);
			assert.strictEqual(markers.coverage.size, 0);
			mapping = { ...mapping, coverageRoot: '/remote' };
			await openActiveFile(path.join(directory, 'edit.php'));
			advanced.setMultiplicity('at-least', 2);
			renderer.refreshActiveEditor();
			assert.deepStrictEqual([...markers.coverage.keys()], [2, 3, 5]);
			display = { backgroundHighlights: false, coverageMarkers: false };
			advancedStats = analyzeCurrentFile(renderer.refreshActiveEditor());
			assert.strictEqual(backgrounds.lines.size, 0);
			assert.strictEqual(markers.coverage.size, 0);
			if (advancedStats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
			assert.strictEqual(advancedStats.combined, 5);
			store.toggle('B');
			renderer.refreshActiveEditor();
			assert.strictEqual(advanced.getSelection().kind, 'standard');
			store.toggle('B');
			advanced.reset();
			// Every display combination must preserve selection and global statistics.
			for (const backgroundHighlights of [true, false]) {
				for (const coverageMarkers of [true, false]) {
					display = { backgroundHighlights, coverageMarkers };
					for (const focusId of [undefined, 'A', 'B']) {
						focus.select(focusId);
						for (const comparison of ['combined', 'shared', 'exclusive'] as const) {
							mode = comparison;
							const snapshot = renderer.refreshActiveEditor();
							if (snapshot.state !== 'mapped') { assert.fail('Expected mapped snapshot'); }
							const visible = buildVisibleCoverage(snapshot.coverage, mode, focusId);
							const expectedMarkers = coverageMarkers ? visible : new Map();
							assert.deepStrictEqual(markers.coverage, expectedMarkers);
							for (const source of store.getAll()) {
								const expected = backgroundHighlights
									? [...visible].filter(([, sources]) => sources.some(item => item.id === source.id)).map(([line]) => line)
									: [];
								assert.deepStrictEqual(backgrounds.lines.get(source.id) ?? [], expected);
							}
							const stats = analyzeCurrentFile(snapshot);
							if (stats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
							assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [5, 3, 2]);
							assert.deepStrictEqual(stats.sources.map(source => source.count), [4, 4]);
							assert.strictEqual(focus.getSourceId(), focusId);
						}
					}
				}
			}
			display = { ...DEFAULT_DISPLAY_OPTIONS };
			focus.select('A');
			mode = 'exclusive';
			const focusedStats = analyzeCurrentFile(renderer.refreshActiveEditor());
			assert.deepStrictEqual(backgrounds.lines.get('A'), [1]);
			assert.strictEqual(backgrounds.lines.has('B'), false);
			if (focusedStats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
			assert.deepStrictEqual([focusedStats.combined, focusedStats.shared, focusedStats.exclusive], [5, 3, 2]);
			focus.select('B');
			renderer.refreshActiveEditor();
			assert.deepStrictEqual(backgrounds.lines.get('B'), [4]);
			assert.strictEqual(backgrounds.lines.has('A'), false);
			mode = 'shared';
			renderer.refreshActiveEditor();
			assert.deepStrictEqual(backgrounds.lines.get('A'), [2, 3, 5]);
			assert.deepStrictEqual(backgrounds.lines.get('B'), [2, 3, 5]);
			assert.deepStrictEqual(markers.coverage.get(2)?.map(source => source.id), ['A', 'B']);
			await openActiveFile(path.join(directory, 'birthdays.php'));
			renderer.refreshActiveEditor();
			assert.strictEqual(focus.getSourceId(), 'B');
			assert.deepStrictEqual([...markers.coverage.keys()], [2]);
			await openActiveFile(path.join(directory, 'edit.php'));
			store.toggle('B');
			renderer.refreshActiveEditor();
			assert.strictEqual(focus.getSourceId(), undefined);
			assert.strictEqual(backgrounds.lines.size, 0);
			store.toggle('B');
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
			const unmapped = renderer.refreshActiveEditor();
			assert.strictEqual(unmapped.state, 'unmapped');
			currentFile.update(analyzeCurrentFile(unmapped));
			assert.deepStrictEqual(currentFile.getChildren().map(row => row.label), ['No mapped coverage']);
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
			const disabled = analyzeCurrentFile(renderer.refreshActiveEditor());
			assert.strictEqual(disabled.state, 'mapped');
			if (disabled.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
			assert.deepStrictEqual(disabled.sources, []);
			assert.deepStrictEqual([disabled.combined, disabled.shared, disabled.exclusive], [0, 0, 0]);
			store.setAllEnabled(true);
			store.remove('B');
			const removed = analyzeCurrentFile(renderer.refreshActiveEditor());
			if (removed.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
			assert.deepStrictEqual(removed.sources.map(item => item.id), ['A']);
			assert.strictEqual(removed.exclusive, 4);
			// Turning display off clears both managers in inactive split panes too.
			const secondDocument = await vscode.workspace.openTextDocument(path.join(directory, 'birthdays.php'));
			await vscode.window.showTextDocument(secondDocument, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
			for (let attempt = 0; attempt < 100 && vscode.window.visibleTextEditors.length < 2; attempt++) {
				await new Promise(resolve => setTimeout(resolve, 20));
			}
			assert.ok(vscode.window.visibleTextEditors.length >= 2);
			backgrounds.clearedEditors.clear();
			markers.clearedEditors.clear();
			display = { backgroundHighlights: false, coverageMarkers: false };
			const hiddenStats = analyzeCurrentFile(renderer.refreshVisibleEditors());
			for (const editor of vscode.window.visibleTextEditors) {
				assert.ok(backgrounds.clearedEditors.has(editor.document.uri.toString()));
				assert.ok(markers.clearedEditors.has(editor.document.uri.toString()));
			}
			assert.strictEqual(backgrounds.lines.size, 0);
			assert.strictEqual(markers.coverage.size, 0);
			assert.strictEqual(hiddenStats.state, 'mapped');
		} finally {
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			backgrounds.dispose();
			markers.dispose();
			currentFile.dispose();
			// Windows file watchers can briefly retain handles after editors close.
			await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		}
	});
});
