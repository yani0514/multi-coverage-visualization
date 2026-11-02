import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { CurrentFileTreeProvider } from '../sidebar/currentFileTreeProvider';
import { CurrentFileStats } from '../coverage/coverageAnalysis';
import { createSourceColorIcon } from '../sidebar/sourceColorIcon';

function mappedStats(): Extract<CurrentFileStats, { state: 'mapped' }> {
	return {
		state: 'mapped', localPath: path.resolve('edit.php'), coveragePath: '/remote/edit.php',
		sources: [
			{ id: 'A', name: 'A.json', filePath: '/runs/A.json', color: 'rgba(1,2,3,0.20)', count: 4 },
			{ id: 'B', name: 'B.json', filePath: '/runs/B.json', color: 'rgba(4,5,6,0.20)', count: 0 }
		], combined: 4, shared: 0, exclusive: 4
	};
}

suite('Current File tree', () => {
	test('shows filename, colored source counts and all aggregate rows without commands', () => {
		const provider = new CurrentFileTreeProvider();
		try {
			provider.update(mappedStats());
			const rows = provider.getChildren();
			assert.deepStrictEqual(rows.map(row => row.label), ['edit.php', 'A.json', 'B.json', 'Combined', 'Shared', 'Exclusive']);
			assert.deepStrictEqual(rows.slice(1).map(row => row.description), ['4 lines', '0 lines', '4 lines', '0 lines', '4 lines']);
			assert.strictEqual((rows[1].iconPath as vscode.Uri).toString(), createSourceColorIcon('rgba(1,2,3,0.20)', true).toString());
			assert.ok(rows.every(row => row.command === undefined));
			assert.strictEqual(new Set(rows.map(row => row.id)).size, rows.length);
			assert.deepStrictEqual(provider.getChildren(rows[0]), []);
		} finally { provider.dispose(); }
	});

	test('mapped, unmapped, no-editor and disabled states replace previous rows and fire refreshes', () => {
		const provider = new CurrentFileTreeProvider();
		let refreshes = 0;
		const listener = provider.onDidChangeTreeData(() => { refreshes++; });
		try {
			assert.strictEqual(provider.getChildren()[0].label, 'No active editor');
			provider.update(mappedStats());
			provider.update({ state: 'unmapped', localPath: '/other.php' });
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['No mapped coverage']);
			provider.update({ state: 'no-editor' });
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['No active editor']);
			provider.update({ ...mappedStats(), sources: [], combined: 0, shared: 0, exclusive: 0 });
			assert.deepStrictEqual(provider.getChildren().map(row => row.label), ['edit.php', 'No enabled coverage sources']);
			assert.strictEqual(refreshes, 4);
		} finally { listener.dispose(); provider.dispose(); }
	});
});
