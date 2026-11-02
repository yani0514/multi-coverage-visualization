import * as vscode from 'vscode';
import { AdvancedComparison, isPairwiseOperation, isValidMultiplicity, MultiplicityRule } from '../coverage/advancedComparison';
import { CoverageStore } from '../coverage/coverageStore';

/** Native pickers are transactional: cancelling never changes the current analysis. */
export function registerAdvancedComparisonCommands(
	store: CoverageStore, analysis: AdvancedComparison, refresh: () => void
): vscode.Disposable[] {
	const pickSource = async (title: string, excluded?: string) => {
		const items = store.getAll().filter(source => source.enabled && source.id !== excluded)
			.map(source => ({ label: source.name, description: source.filePath, sourceId: source.id }));
		return vscode.window.showQuickPick(items, { title, ignoreFocusOut: true });
	};
	const register = (name: string, handler: (...args: unknown[]) => unknown) =>
		vscode.commands.registerCommand(`multi-coverage-visualization.${name}`, handler);
	return [
		register('useStandardComparison', () => { analysis.reset(); refresh(); }),
		register('configurePairwise', async () => {
			if (store.getAll().filter(source => source.enabled).length < 2) {
				void vscode.window.showInformationMessage('Enable at least two coverage sources to compare a pair.');
				return;
			}
			const a = await pickSource('Pairwise Comparison: Source A');
			if (!a) { return; }
			const b = await pickSource('Pairwise Comparison: Source B', a.sourceId);
			if (!b) { return; }
			if (analysis.setPairwise(a.sourceId, b.sourceId)) { refresh(); }
		}),
		register('selectPairwiseSource', async side => {
			if (side !== 'sourceA' && side !== 'sourceB') { return; }
			const current = analysis.getSelection();
			if (current.kind !== 'pairwise') { return; }
			const picked = await pickSource(`Pairwise Comparison: Source ${side === 'sourceA' ? 'A' : 'B'}`, side === 'sourceA' ? current.sourceB : current.sourceA);
			if (!picked) { return; }
			// Avoid reviving a pair which became invalid while the picker was open.
			const latest = analysis.getSelection();
			if (latest.kind !== 'pairwise') { return; }
			const a = side === 'sourceA' ? picked.sourceId : latest.sourceA;
			const b = side === 'sourceB' ? picked.sourceId : latest.sourceB;
			if (analysis.setPairwise(a, b, latest.operation)) { refresh(); }
		}),
		register('setPairwiseOperation', operation => {
			if (!isPairwiseOperation(operation)) { return; }
			analysis.setPairwiseOperation(operation);
			refresh();
		}),
		register('configureMultiplicity', async () => {
			const enabledCount = () => store.getAll().filter(source => source.enabled).length;
			if (!enabledCount()) {
				void vscode.window.showInformationMessage('Enable a coverage source before configuring N-of-M filtering.');
				return;
			}
			const rules: { label: string; rule: MultiplicityRule }[] = [
				{ label: 'Covered by at least N sources', rule: 'at-least' },
				{ label: 'Covered by exactly N sources', rule: 'exactly' }
			];
			const rule = await vscode.window.showQuickPick(rules, { title: 'N-of-M Filter', ignoreFocusOut: true });
			if (!rule) { return; }
			const input = await vscode.window.showInputBox({
				title: 'N-of-M Filter: N', prompt: `Enter a whole number from 1 to ${enabledCount()}.`,
				value: '1', ignoreFocusOut: true,
				validateInput: value => /^\d+$/.test(value) && isValidMultiplicity(Number(value), enabledCount())
					? undefined : `Enter a whole number from 1 to ${enabledCount()}.`
			});
			if (input === undefined) { return; }
			if (analysis.setMultiplicity(rule.rule, Number(input))) { refresh(); }
		})
	];
}
