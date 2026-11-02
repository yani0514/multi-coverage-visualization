import * as assert from 'assert';
import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';
import { DecorationManager } from '../editor/decorationManager';
import { MarkerManager } from '../editor/markerManager';

function decorationFactory() {
	const entries: { type: vscode.TextEditorDecorationType; disposals: number }[] = [];
	const create = (_options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType => {
		const entry = {
			disposals: 0,
			type: { key: `decoration-${entries.length}`, dispose: () => { entry.disposals++; } }
		};
		entries.push(entry);
		return entry.type;
	};
	return { entries, create };
}

function editorFixture(lineCount = 4) {
	const calls: { type: vscode.TextEditorDecorationType; ranges: readonly vscode.Range[] | readonly vscode.DecorationOptions[] }[] = [];
	const document = {
		lineCount,
		lineAt: (line: number) => {
			assert.ok(Number.isInteger(line) && line >= 0 && line < lineCount);
			return { range: new vscode.Range(line, 0, line, 10) };
		}
	};
	const editor = {
		document,
		setDecorations: (type: vscode.TextEditorDecorationType, ranges: readonly vscode.Range[] | readonly vscode.DecorationOptions[]) => { calls.push({ type, ranges }); }
	} as unknown as vscode.TextEditor;
	return { editor, calls };
}

function source(id: string, name = id): CoverageSource {
	return { id, name, filePath: id, color: 'rgba(1,2,3,0.20)', enabled: true, coverage: new Map() };
}

suite('Decoration lifecycle and actual manager behavior', () => {
	test('background cache reuse, bounds checks, clear, pruning, and disposal have distinct effects', () => {
		const factory = decorationFactory();
		const manager = new DecorationManager(factory.create);
		const fixture = editorFixture();
		manager.applySourceCoverage(fixture.editor, 'A', 'red', [0, -1, 1.5, NaN, Infinity, 999, 1]);
		assert.strictEqual(fixture.calls[0].ranges.length, 1);
		assert.strictEqual((fixture.calls[0].ranges[0] as vscode.Range).start.line, 0);
		manager.applySourceCoverage(fixture.editor, 'A', 'red', [2]);
		assert.strictEqual(factory.entries.length, 1);
		manager.clear(fixture.editor);
		assert.strictEqual(fixture.calls.at(-1)!.ranges.length, 0);
		assert.strictEqual(factory.entries[0].disposals, 0);
		manager.retainSources([]);
		assert.strictEqual(factory.entries[0].disposals, 1);
		manager.applySourceCoverage(fixture.editor, 'A', 'red', [1]);
		assert.strictEqual(factory.entries.length, 2);
		manager.dispose(); manager.dispose();
		assert.deepStrictEqual(factory.entries.map(entry => entry.disposals), [1, 1]);
	});

	test('repeated source load/remove cycles release every background type', () => {
		const factory = decorationFactory();
		const manager = new DecorationManager(factory.create);
		const { editor } = editorFixture();
		for (let index = 0; index < 100; index++) {
			manager.applySourceCoverage(editor, `run-${index}`, 'red', [1]);
			manager.retainSources([]);
		}
		assert.strictEqual(factory.entries.length, 100);
		assert.ok(factory.entries.every(entry => entry.disposals === 1));
		manager.dispose();
	});

	test('marker groups are applied once per combination; bounds and literal names are respected', () => {
		const factory = decorationFactory();
		const manager = new MarkerManager(factory.create);
		const fixture = editorFixture();
		const pair = [source('A', '*run*.json'), source('B')];
		manager.applyMarkers(fixture.editor, new Map([[0, pair], [1, pair], [2, [...pair].reverse()], [1.5, pair], [999, pair], [3, [pair[0]]]]));
		const applied = fixture.calls.filter(call => call.ranges.length);
		assert.strictEqual(applied.length, 1);
		assert.strictEqual(applied[0].ranges.length, 2);
		const options = applied[0].ranges as vscode.DecorationOptions[];
		assert.strictEqual(options[0].hoverMessage, options[1].hoverMessage);
		assert.ok((options[0].hoverMessage as vscode.MarkdownString).value.includes('\\*run\\*'));
		manager.clear(fixture.editor);
		assert.strictEqual(factory.entries[0].disposals, 0);
		manager.dispose();
		assert.strictEqual(factory.entries[0].disposals, 1);
	});

	test('valid POSIX source IDs containing separators cannot collide in marker cache keys', () => {
		const factory = decorationFactory();
		const manager = new MarkerManager(factory.create);
		const fixture = editorFixture();
		manager.applyMarkers(fixture.editor, new Map([
			[1, [source('a|b'), source('c')]],
			[2, [source('a'), source('b|c')]]
		]));
		assert.strictEqual(factory.entries.length, 2);
		assert.strictEqual(fixture.calls.filter(call => call.ranges.length).length, 2);
		manager.dispose();
	});

	test('removing a source prunes its marker combinations while preserving reusable live combinations', () => {
		const factory = decorationFactory();
		const manager = new MarkerManager(factory.create);
		const { editor } = editorFixture();
		const a = source('A'), b = source('B'), c = source('C');
		manager.applyMarkers(editor, new Map([[1, [a, b]], [2, [b, c]]]));
		manager.retainSources(['A', 'B']);
		assert.deepStrictEqual(factory.entries.map(entry => entry.disposals), [0, 1]);
		manager.applyMarkers(editor, new Map([[1, [a, b]]]));
		assert.strictEqual(factory.entries.length, 2);
		manager.dispose(); manager.dispose();
		assert.ok(factory.entries.every(entry => entry.disposals === 1));
	});

	test('historical marker cache is bounded during many distinct combinations', () => {
		const factory = decorationFactory();
		const manager = new MarkerManager(factory.create);
		const { editor, calls } = editorFixture();
		for (let index = 0; index < 300; index++) {
			manager.applyMarkers(editor, new Map([[1, [source('A'), source(`run-${index}`)]]]));
		}
		assert.strictEqual(factory.entries.filter(entry => entry.disposals === 0).length, 256);
		calls.length = 0;
		manager.clear(editor);
		assert.strictEqual(calls.length, 1, 'Clear only the current editor combination, not every historical cached type');
		manager.dispose();
		assert.ok(factory.entries.every(entry => entry.disposals === 1));
	});

	test('a document requiring more than the historical limit keeps all its active combinations', () => {
		const factory = decorationFactory();
		const manager = new MarkerManager(factory.create);
		const { editor } = editorFixture(300);
		const coverage = new Map<number, CoverageSource[]>();
		for (let index = 0; index < 300; index++) {
			coverage.set(index + 1, [source('A'), source(`run-${index}`)]);
		}
		manager.applyMarkers(editor, coverage);
		assert.strictEqual(factory.entries.length, 300);
		assert.ok(factory.entries.every(entry => entry.disposals === 0));
		manager.clear(editor);
		manager.pruneUnusedCombinations();
		assert.strictEqual(factory.entries.filter(entry => entry.disposals === 0).length, 256);
		manager.dispose();
	});
});
