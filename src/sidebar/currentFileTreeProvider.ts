import * as vscode from 'vscode';
import * as path from 'path';
import { CurrentFileStats } from '../coverage/coverageAnalysis';
import { COMPARISON_MODES } from '../coverage/comparisonMode';
import { CurrentFileTreeItem } from './currentFileTreeItem';
import { createSourceColorIcon } from './sourceColorIcon';

export class CurrentFileTreeProvider implements vscode.TreeDataProvider<CurrentFileTreeItem>, vscode.Disposable {
	private stats: CurrentFileStats = { state: 'no-editor' };
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	update(stats: CurrentFileStats): void {
		this.stats = stats;
		this.changed.fire();
	}

	getTreeItem(item: CurrentFileTreeItem): vscode.TreeItem { return item; }

	getChildren(parent?: CurrentFileTreeItem): CurrentFileTreeItem[] {
		if (parent) {
			return [];
		}
		const stats = this.stats;
		if (stats.state === 'no-editor') {
			const item = new CurrentFileTreeItem('empty', 'No active editor');
			item.tooltip = 'Open a local source file to inspect its coverage.';
			return [item];
		}
		if (stats.state === 'unmapped') {
			const item = new CurrentFileTreeItem('empty', 'No mapped coverage');
			item.tooltip = `${stats.localPath}\nLoad coverage for this file or use Multi Coverage: Configure Path Mapping.`;
			return [item];
		}
		const file = new CurrentFileTreeItem('file', path.basename(stats.localPath));
		file.iconPath = new vscode.ThemeIcon('file-code');
		file.tooltip = `${stats.localPath}\nCoverage path: ${stats.coveragePath}`;
		if (stats.sources.length === 0) {
			const item = new CurrentFileTreeItem('empty', 'No enabled coverage sources');
			item.tooltip = 'Enable a run in Coverage Sources to see its line counts.';
			return [file, item];
		}
		const sourceRows = stats.sources.map(source => {
			const item = new CurrentFileTreeItem(`source:${source.id}`, source.name, lineCount(source.count));
			item.iconPath = createSourceColorIcon(source.color, true);
			item.tooltip = `${source.name}\n${source.filePath}\n${lineCount(source.count)} in coverage data (line 0 excluded).`;
			return item;
		});
		const aggregateRows = COMPARISON_MODES.map(info => {
			const item = new CurrentFileTreeItem(`count:${info.mode}`, info.label, lineCount(stats[info.mode]));
			item.tooltip = `${info.description}\nCounts positive coverage lines, including lines beyond the editor length.`;
			return item;
		});
		return [file, ...sourceRows, ...aggregateRows];
	}

	dispose(): void { this.changed.dispose(); }
}

function lineCount(count: number): string {
	return `${count} ${count === 1 ? 'line' : 'lines'}`;
}
