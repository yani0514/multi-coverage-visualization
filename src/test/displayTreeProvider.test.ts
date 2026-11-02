import * as assert from 'assert';
import * as vscode from 'vscode';
import { DisplayTreeProvider } from '../sidebar/displayTreeProvider';
import { DEFAULT_DISPLAY_OPTIONS } from '../editor/displayOptions';

suite('Display tree', () => {
	test('shows two checked native checkboxes with stable IDs and toggle commands', () => {
		const provider = new DisplayTreeProvider();
		try {
			const rows = provider.getChildren();
			assert.deepStrictEqual(rows.map(row => row.label), ['Background Highlights', 'Coverage Markers']);
			assert.deepStrictEqual(rows.map(row => row.checkboxState), [vscode.TreeItemCheckboxState.Checked, vscode.TreeItemCheckboxState.Checked]);
			assert.deepStrictEqual(rows.map(row => row.id), ['backgroundHighlights', 'coverageMarkers']);
			assert.deepStrictEqual(rows[0].command?.arguments, ['backgroundHighlights']);
			assert.deepStrictEqual(provider.getChildren(rows[0]), []);
		} finally { provider.dispose(); }
	});

	test('restores checkbox states and changes each preference independently', () => {
		const provider = new DisplayTreeProvider({ backgroundHighlights: false, coverageMarkers: true });
		let changes = 0;
		const listener = provider.onDidChangeTreeData(() => { changes++; });
		try {
			assert.deepStrictEqual(provider.getChildren().map(row => row.checkboxState), [vscode.TreeItemCheckboxState.Unchecked, vscode.TreeItemCheckboxState.Checked]);
			provider.setOption('coverageMarkers', false);
			assert.deepStrictEqual(provider.getOptions(), { backgroundHighlights: false, coverageMarkers: false });
			provider.setOption('backgroundHighlights', true);
			assert.deepStrictEqual(provider.getOptions(), { backgroundHighlights: true, coverageMarkers: false });
			provider.setOption('backgroundHighlights', true);
			assert.strictEqual(changes, 2);
		} finally { listener.dispose(); provider.dispose(); }
	});

	test('options do not expose mutable provider state or change shared defaults', () => {
		const initial = { ...DEFAULT_DISPLAY_OPTIONS };
		const provider = new DisplayTreeProvider(initial);
		try {
			initial.backgroundHighlights = false;
			provider.getOptions().coverageMarkers = false;
			assert.deepStrictEqual(provider.getOptions(), DEFAULT_DISPLAY_OPTIONS);
		} finally { provider.dispose(); }
	});
});
