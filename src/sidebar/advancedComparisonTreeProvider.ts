import * as vscode from 'vscode';
import { AdvancedSelection, PAIRWISE_OPERATIONS } from '../coverage/advancedComparison';
import { CoverageSource } from '../coverage/types';

export class AdvancedComparisonTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
	private selection: AdvancedSelection = { kind: 'standard' };
	private sources: readonly CoverageSource[] = [];
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	update(selection: AdvancedSelection, sources: readonly CoverageSource[]): void {
		this.selection = selection;
		this.sources = sources.filter(source => source.enabled);
		this.changed.fire();
	}
	getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }
	getChildren(parent?: vscode.TreeItem): vscode.TreeItem[] {
		if (parent) { return []; }
		const selection = this.selection;
		const rows = [this.row('standard', 'Comparison / Focus', selection.kind === 'standard', 'useStandardComparison')];
		rows[0]!.tooltip = 'Use the Comparison and Focus Source selections; turn off advanced filtering.';
		if (selection.kind === 'pairwise') {
			for (const side of ['sourceA', 'sourceB'] as const) {
				const source = this.sources.find(item => item.id === selection[side]);
				const item = this.row(side, `Source ${side === 'sourceA' ? 'A' : 'B'}`, undefined, 'selectPairwiseSource', [side]);
				item.description = source?.name ?? 'Not selected';
				item.tooltip = source?.filePath;
				item.accessibilityInformation = { label: `${item.label}, ${item.description}. Activate to change this source.` };
				rows.push(item);
			}
			for (const info of PAIRWISE_OPERATIONS) {
				const item = this.row(info.operation, info.label, info.operation === selection.operation, 'setPairwiseOperation', [info.operation]);
				item.tooltip = `${info.description} Other enabled runs are excluded from pairwise visualization.`;
				rows.push(item);
			}
		} else {
			const available = this.sources.length >= 2;
			const item = this.row('pairwise', 'Pairwise Comparison', false, available ? 'configurePairwise' : undefined);
			item.description = available ? 'Choose A and B' : 'Requires two enabled sources';
			item.tooltip = available ? 'Choose two enabled coverage sources to compare.' : 'Enable at least two runs in Coverage Sources to compare a pair.';
			item.accessibilityInformation = { label: `Pairwise Comparison. ${item.description}.` };
			rows.push(item);
		}
		const multiplicity = this.row('multiplicity', 'N-of-M Filter', selection.kind === 'multiplicity', this.sources.length ? 'configureMultiplicity' : undefined);
		multiplicity.description = selection.kind === 'multiplicity'
			? `${selection.rule === 'at-least' ? 'At least' : 'Exactly'} ${selection.count} of ${this.sources.length}`
			: this.sources.length ? 'Configure…' : 'Requires an enabled source';
		multiplicity.tooltip = 'Count coverage across all enabled sources; replaces standard and pairwise selection.';
		multiplicity.accessibilityInformation = { label: `N-of-M Filter, ${selection.kind === 'multiplicity' ? 'selected' : 'not selected'}, ${multiplicity.description}.` };
		rows.push(multiplicity);
		return rows;
	}

	private row(id: string, label: string, selected?: boolean, command?: string, args: unknown[] = []): vscode.TreeItem {
		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.id = id;
		item.accessibilityInformation = { label: `${label}${selected === undefined ? '' : `, ${selected ? 'selected' : 'not selected'}`}` };
		if (selected !== undefined) { item.iconPath = new vscode.ThemeIcon(selected ? 'circle-filled' : 'circle-outline'); }
		if (command) { item.command = { command: `multi-coverage-visualization.${command}`, title: label, arguments: args }; }
		return item;
	}
	dispose(): void { this.changed.dispose(); }
}
