import * as assert from 'assert';
import * as vscode from 'vscode';
import { CoverageStore } from '../coverage/coverageStore';
import { FocusSourceSelection } from '../coverage/focusSourceSelection';
import { FocusSourceTreeProvider } from '../sidebar/focusSourceTreeProvider';
import { ComparisonTreeProvider } from '../sidebar/comparisonTreeProvider';
import { createSourceColorIcon } from '../sidebar/sourceColorIcon';
import { CoverageSource } from '../coverage/types';

suite('Focus Source and dynamic Comparison trees', () => {
	test('initially only None is selected, with a clear command argument', () => {
		const provider = new FocusSourceTreeProvider();
		try {
			const rows = provider.getChildren();
			assert.deepStrictEqual(rows.map(row => row.label), ['None']);
			assert.strictEqual((rows[0].iconPath as vscode.ThemeIcon).id, 'circle-filled');
			assert.deepStrictEqual(rows[0].command?.arguments, [null]);
		} finally { provider.dispose(); }
	});
	test('load, select, disable, remove and zero-source updates replace rows and radio state', () => {
		const store = new CoverageStore();
		const focus = new FocusSourceSelection(store);
		const provider = new FocusSourceTreeProvider();
		let changes = 0;
		const listener = provider.onDidChangeTreeData(() => { changes++; });
		const source: CoverageSource = { id: 'A', name: 'A.json', filePath: '/A.json', color: 'rgba(1,2,3,0.20)', enabled: true, coverage: new Map() };
		const update = () => provider.update(store.getAll(), focus.getSourceId());
		try {
			store.add(source);
			store.add({ ...source, id: 'B', name: 'B.json', enabled: false });
			update();
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['None', 'A.json']);
			focus.select('A');
			update();
			const rows = provider.getChildren();
			assert.strictEqual((rows[0].iconPath as vscode.ThemeIcon).id, 'circle-outline');
			assert.strictEqual((rows[1].iconPath as vscode.Uri).toString(), createSourceColorIcon(source.color, true).toString());
			assert.deepStrictEqual(rows[1].command?.arguments, ['A']);
			store.toggle('A'); update();
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['None']);
			store.toggle('A'); focus.select('A'); store.remove('A'); update();
			assert.strictEqual((provider.getChildren()[0].iconPath as vscode.ThemeIcon).id, 'circle-filled');
			assert.strictEqual(changes, 4);
		} finally { listener.dispose(); provider.dispose(); }
	});
	test('comparison has exactly three context-aware labels while preserving the mode', () => {
		const provider = new ComparisonTreeProvider('shared');
		try {
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['Combined', 'Shared', 'Exclusive']);
			provider.setFocusSource('A');
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['Covered by Focus', 'Exclusive to Focus', 'Shared with Focus']);
			assert.strictEqual(provider.getMode(), 'shared');
			assert.strictEqual((provider.getChildren()[2].iconPath as vscode.ThemeIcon).id, 'circle-filled');
			provider.setMode('exclusive');
			provider.setFocusSource(undefined);
			assert.strictEqual(provider.getChildren()[2].label, 'Exclusive');
			assert.strictEqual(provider.getMode(), 'exclusive');
		} finally { provider.dispose(); }
	});
});
