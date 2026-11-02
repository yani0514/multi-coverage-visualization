import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CoverageTreeItem } from '../sidebar/coverageTreeItem';
import { CoverageTreeProvider } from '../sidebar/coverageTreeProvider';
import { ComparisonTreeItem } from '../sidebar/comparisonTreeItem';
import { FocusSourceTreeItem } from '../sidebar/focusSourceTreeItem';
import { DisplayTreeProvider } from '../sidebar/displayTreeProvider';
import { CurrentFileTreeItem } from '../sidebar/currentFileTreeItem';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageSource } from '../coverage/types';
import { MarkerManager } from '../editor/markerManager';

function source(enabled = true): CoverageSource {
	return { id: '/runs/run.json', name: 'long-測試-coverage-run.json', filePath: '/runs/run.json', color: 'rgba(234, 179, 8, 0.20)', enabled, coverage: new Map() };
}

suite('Sidebar UX and accessibility', () => {
	test('marker SVGs retain source hue and add contrast outlines without changing grouping', () => {
		let svg = '';
		let applied = 0;
		const manager = new MarkerManager(options => {
			svg = decodeURIComponent((options.after!.contentIconPath as vscode.Uri).toString());
			return { key: 'contrast-marker', dispose: () => {} };
		});
		const editor = {
			document: { lineCount: 1, lineAt: () => ({ range: new vscode.Range(0, 0, 0, 10) }) },
			setDecorations: (_type: vscode.TextEditorDecorationType, ranges: unknown[]) => { if (ranges.length) { applied++; } }
		} as unknown as vscode.TextEditor;
		try {
			manager.applyMarkers(editor, new Map([[1, [source(), { ...source(), id: '/B.json', color: 'rgba(29,78,216,0.20)' }]]]));
			assert.strictEqual(applied, 1);
			assert.ok(svg.includes('#ffffff') && svg.includes('#202020'));
			assert.match(svg, /rgb\(234,\s*179,\s*8\)/);
			assert.ok(svg.includes('rgb(29,78,216)'));
		} finally { manager.dispose(); }
	});
	test('source state is communicated without extra row text or color alone', () => {
		const enabled = new CoverageTreeItem(source());
		const disabled = new CoverageTreeItem(source(false));
		assert.strictEqual(enabled.description, undefined);
		assert.strictEqual(disabled.description, undefined);
		assert.match(enabled.accessibilityInformation!.label, /enabled.*disable/);
		assert.match(disabled.accessibilityInformation!.label, /disabled.*enable/);
		assert.strictEqual(enabled.contextValue, 'coverageSource.enabled');
		assert.strictEqual(disabled.contextValue, 'coverageSource.disabled');
		assert.ok(String(enabled.tooltip).includes(source().filePath));
		const svg = (item: vscode.TreeItem) => decodeURIComponent((item.iconPath as vscode.Uri).toString());
		assert.ok(svg(enabled).includes('fill="rgb(234,179,8)"') || /fill="rgb\(234,\s*179,\s*8\)"/.test(svg(enabled)));
		assert.notStrictEqual(svg(enabled), svg(disabled));
		for (const icon of [svg(enabled), svg(disabled)]) {
			assert.ok(icon.includes('#ffffff') && icon.includes('#202020'));
		}
	});
	test('radio selections and statistics have useful accessible labels', () => {
		assert.match(new ComparisonTreeItem('shared', true).accessibilityInformation!.label, /Shared, selected/);
		assert.match(new ComparisonTreeItem('shared', false, true).accessibilityInformation!.label, /Shared with Focus, not selected/);
		assert.match(new FocusSourceTreeItem(source(), true).accessibilityInformation!.label, /selected focus source/);
		assert.match(new FocusSourceTreeItem(undefined, true).accessibilityInformation!.label, /None, selected/);
		const statistic = new CurrentFileTreeItem('shared', 'Shared', '1 line');
		assert.strictEqual(statistic.accessibilityInformation!.label, 'Shared, 1 line');
		assert.strictEqual(statistic.command, undefined);
	});
	test('twelve long-named sources stay flat and retain full names and paths for truncation', () => {
		const store = new CoverageStore();
		for (let index = 0; index < 12; index++) {
			store.add({ ...source(), id: `/runs/${index}.json`, filePath: `/runs/${index}.json`, name: `${index}-${'long-name-'.repeat(8)}.json` });
		}
		const provider = new CoverageTreeProvider(store);
		try {
			assert.strictEqual(provider.getChildren().length, 12);
			for (const item of provider.getChildren()) {
				assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
				assert.ok(String(item.tooltip).includes(item.source.filePath));
				assert.ok(item.accessibilityInformation!.label.includes(item.source.name));
			}
		} finally { provider.dispose(); }
	});
	test('restored Display options are reflected in native checkboxes and accessible names', () => {
		const provider = new DisplayTreeProvider({ backgroundHighlights: false, coverageMarkers: true });
		try {
			const rows = provider.getChildren();
			assert.strictEqual(rows[0].checkboxState, vscode.TreeItemCheckboxState.Unchecked);
			assert.strictEqual(rows[1].checkboxState, vscode.TreeItemCheckboxState.Checked);
			assert.match(rows[0].accessibilityInformation!.label, /Background Highlights/);
		} finally { provider.dispose(); }
	});
	test('manifest view order, toolbar and context actions follow the sidebar workflow', async () => {
		const extension = vscode.extensions.all.find(item => item.packageJSON.name === 'multi-coverage-visualization');
		assert.ok(extension);
		const manifest = JSON.parse(await fs.readFile(path.join(extension.extensionPath, 'package.json'), 'utf8'));
		assert.deepStrictEqual(manifest.contributes.views.multiCoverage.map((view: { name: string }) => view.name),
			['Coverage Sources', 'Comparison', 'Focus Source', 'Current File', 'Display', 'Advanced Comparison']);
		assert.strictEqual(manifest.contributes.views.multiCoverage[5].visibility, 'collapsed');
		const toolbar = manifest.contributes.menus['view/title'].filter((item: { group: string }) => item.group.startsWith('navigation'));
		assert.deepStrictEqual(toolbar.map((item: { command: string }) => item.command.split('.').pop()),
			['loadCoverage', 'enableAllCoverageSources', 'disableAllCoverageSources']);
		const menu = manifest.contributes.menus['view/item/context'];
		assert.deepStrictEqual(menu.map((item: { command: string }) => item.command.split('.').pop()), ['showOnlyCoverageSource', 'focusCoverageSource', 'removeCoverageSource']);
		assert.match(menu[1].when, /coverageSource\.enabled/);
		for (const index of [0, 2]) {
			const expression = menu[index].when.split('=~ /')[1].slice(0, -1);
			assert.ok(new RegExp(expression).test('coverageSource.enabled'));
			assert.ok(new RegExp(expression).test('coverageSource.disabled'));
		}
		assert.notStrictEqual(menu[1].group.split('@')[0], menu[2].group.split('@')[0]);
		for (const command of manifest.contributes.commands) {
			assert.ok(command.title.startsWith('Multi Coverage:'), command.title);
		}
	});
});
