import * as assert from 'assert';
import * as vscode from 'vscode';
import { AdvancedComparisonTreeProvider } from '../sidebar/advancedComparisonTreeProvider';
import { CoverageSource } from '../coverage/types';

const sources: CoverageSource[] = ['A', 'B', 'C'].map(id => ({ id, name: `${id}.json`, filePath: `/${id}.json`, color: 'red', enabled: true, coverage: new Map() }));

suite('Advanced Comparison tree', () => {
	test('empty and one-source states are compact and pairwise is unavailable', () => {
		const provider = new AdvancedComparisonTreeProvider();
		try {
			assert.strictEqual(provider.getChildren().length, 3);
			assert.strictEqual(provider.getChildren()[1].command, undefined);
			assert.strictEqual(provider.getChildren()[2].command, undefined);
			provider.update({ kind: 'standard' }, sources.slice(0, 1));
			assert.strictEqual(provider.getChildren()[1].command, undefined);
			assert.ok(provider.getChildren()[2].command);
		} finally { provider.dispose(); }
	});
	test('pair selection shows A/B and exactly four operations with one selected radio', () => {
		const provider = new AdvancedComparisonTreeProvider();
		try {
			provider.update({ kind: 'pairwise', sourceA: 'A', sourceB: 'B', operation: 'only-b' }, sources);
			const rows = provider.getChildren();
			assert.deepStrictEqual(rows.map(row => row.label), ['Comparison / Focus', 'Source A', 'Source B', 'Both', 'Only A', 'Only B', 'A or B', 'N-of-M Filter']);
			assert.strictEqual(rows[1].description, 'A.json');
			assert.strictEqual(rows[2].description, 'B.json');
			assert.strictEqual((rows[5].iconPath as vscode.ThemeIcon).id, 'circle-filled');
			assert.deepStrictEqual(rows[5].command?.arguments, ['only-b']);
			assert.deepStrictEqual(provider.getChildren(rows[0]), []);
		} finally { provider.dispose(); }
	});
	test('N-of-M uses a single summary row; returning to standard removes pair controls', () => {
		const provider = new AdvancedComparisonTreeProvider();
		try {
			provider.update({ kind: 'multiplicity', rule: 'exactly', count: 2 }, sources);
			assert.strictEqual(provider.getChildren().length, 3);
			assert.strictEqual(provider.getChildren()[2].description, 'Exactly 2 of 3');
			provider.update({ kind: 'standard' }, sources);
			assert.strictEqual((provider.getChildren()[0].iconPath as vscode.ThemeIcon).id, 'circle-filled');
		} finally { provider.dispose(); }
	});
});
