import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceConfig } from './config/workspaceConfig';
import { askForPathMapping } from './config/configurePathMapping';

import { parseCoverageFile } from './coverage/parser';
import { CoverageStore } from './coverage/coverageStore';
import { CoverageQuery } from './coverage/coverageQuery';
import { CoverageSource } from './coverage/types';
import {
	ComparisonMode,
	isComparisonMode
} from './coverage/comparisonMode';

import { PathResolver } from './paths/pathResolver';

import { DecorationManager } from './editor/decorationManager';
import { getCoverageColor } from './editor/coverageColors';
import { MarkerManager } from './editor/markerManager';
import { EditorCoverageRenderer } from './editor/editorCoverageRenderer';

import { CoverageTreeProvider } from './sidebar/coverageTreeProvider';
import { getCoverageSourceId } from './sidebar/coverageSourceArgument';
import { ComparisonTreeProvider } from './sidebar/comparisonTreeProvider';
import { CurrentFileTreeProvider } from './sidebar/currentFileTreeProvider';
import { analyzeCurrentFile } from './coverage/coverageAnalysis';
import { FocusSourceSelection } from './coverage/focusSourceSelection';
import { FocusSourceTreeProvider } from './sidebar/focusSourceTreeProvider';
import { DisplayTreeProvider } from './sidebar/displayTreeProvider';
import { DisplayOptionKey, isDisplayOptionKey } from './editor/displayOptions';
import { AdvancedComparison } from './coverage/advancedComparison';
import { AdvancedComparisonTreeProvider } from './sidebar/advancedComparisonTreeProvider';
import { registerAdvancedComparisonCommands } from './sidebar/advancedComparisonCommands';

export function activate(
	context: vscode.ExtensionContext
) {
	console.log(
		'========== MULTI COVERAGE EXTENSION ACTIVATED =========='
	);

	const store = new CoverageStore();
	const advancedComparison = new AdvancedComparison(store);
	const focusSelection = new FocusSourceSelection(store);
	const workspaceConfig = new WorkspaceConfig(context.workspaceState);
	const query = new CoverageQuery(store);

	const pathResolver = new PathResolver();

	const decorationManager =
		new DecorationManager();
	const markerManager = new MarkerManager();

	const coverageTreeProvider =
		new CoverageTreeProvider(store);

	const comparisonTreeProvider =
		new ComparisonTreeProvider(workspaceConfig.getComparisonMode());
	const currentFileTreeProvider = new CurrentFileTreeProvider();
	const focusSourceTreeProvider = new FocusSourceTreeProvider();
	const displayTreeProvider = new DisplayTreeProvider(workspaceConfig.getDisplayOptions());
	const advancedTreeProvider = new AdvancedComparisonTreeProvider();

	let pathMapping = workspaceConfig.getPathMapping();

	const renderer =
		new EditorCoverageRenderer({
			store,
			query,
			pathResolver,
			decorationManager,
			markerManager,
			getPathMapping: () =>
				pathMapping,
			getComparisonMode: () =>
				comparisonTreeProvider.getMode(),
			getFocusSourceId: () => focusSelection.getSourceId(),
			getDisplayOptions: () => displayTreeProvider.getOptions(),
			getAdvancedSelection: () => advancedComparison.getSelection()
		});

	const coverageTreeView =
		vscode.window.createTreeView(
			'multiCoverage.sources',
			{
				treeDataProvider:
					coverageTreeProvider
			}
		);

	const comparisonTreeView =
		vscode.window.createTreeView(
			'multiCoverage.comparison',
			{
				treeDataProvider:
					comparisonTreeProvider
			}
		);

	const updateSourceContext = () => {
		void vscode.commands.executeCommand(
			'setContext',
			'multiCoverage.hasSources',
			store.size > 0
		);
	};
	const currentFileTreeView = vscode.window.createTreeView('multiCoverage.currentFile', {
		treeDataProvider: currentFileTreeProvider
	});
	const focusSourceTreeView = vscode.window.createTreeView('multiCoverage.focusSource', {
		treeDataProvider: focusSourceTreeProvider
	});
	const displayTreeView = vscode.window.createTreeView('multiCoverage.display', {
		treeDataProvider: displayTreeProvider,
		manageCheckboxStateManually: true
	});
	const advancedTreeView = vscode.window.createTreeView('multiCoverage.advancedComparison', {
		treeDataProvider: advancedTreeProvider
	});

	const refreshSources = () => {
		const sourceIds = store.getAll().map(source => source.id);
		decorationManager.retainSources(sourceIds);
		markerManager.retainSources(sourceIds);
		coverageTreeProvider.refresh();
		updateSourceContext();
	};

	const refreshVisualization = (allVisible = true) => {
		const advanced = advancedComparison.getSelection();
		advancedTreeProvider.update(advanced, store.getAll());
		comparisonTreeView.message = advanced.kind === 'standard' ? undefined : 'Advanced Comparison is active. Select a mode here to return.';
		const focusId = focusSelection.getSourceId();
		focusSourceTreeProvider.update(store.getAll(), focusId);
		comparisonTreeProvider.setFocusSource(focusId);
		const snapshot = allVisible ? renderer.refreshVisibleEditors() : renderer.refreshActiveEditor();
		currentFileTreeProvider.update(analyzeCurrentFile(snapshot));
	};

	const refreshSourcesAndVisualization =
		() => {
			refreshSources();
			refreshVisualization();
		};

	updateSourceContext();
	const advancedCommands = registerAdvancedComparisonCommands(store, advancedComparison, () => refreshVisualization(true));

	// Apply changes immediately; a storage failure must not disable this session.
	const persistConfiguration = async (save: () => Promise<void>) => {
		try {
			await save();
		} catch (error) {
			void vscode.window.showWarningMessage(
				`Multi Coverage: configuration is active for this session but could not be saved: ${error}`
			);
		}
	};

	// Share an in-progress dialog between load/configure commands.
	let mappingRequest: Promise<boolean> | undefined;
	const configureMapping = (): Promise<boolean> => {
		if (mappingRequest) {
			return mappingRequest;
		}
		mappingRequest = (async () => {
			try {
				const mapping = await askForPathMapping(pathMapping);
				if (!mapping) {
					return false;
				}
				pathMapping = mapping;
				refreshVisualization();
				await persistConfiguration(() => workspaceConfig.savePathMapping(mapping));
				return true;
			} catch (error) {
				void vscode.window.showErrorMessage(`Failed to configure path mapping: ${error}`);
				return false;
			} finally {
				mappingRequest = undefined;
			}
		})();
		return mappingRequest;
	};
	const configureMappingCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.configurePathMapping', configureMapping
	);

	/*
	 * Load Coverage File
	 */
	const loadCoverageCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.loadCoverage',
			async () => {
				const files =
					await vscode.window.showOpenDialog({
						canSelectMany: false,
						openLabel:
							'Load Coverage File',
						filters: {
							'JSON Coverage Files': [
								'json'
							]
						}
					});

				if (
					!files ||
					files.length === 0
				) {
					return;
				}

				const selectedFile = files[0];

				try {
					const coverage =
						await parseCoverageFile(
							selectedFile.fsPath
						);

					const existingSource =
						store.get(
							selectedFile.fsPath
						);

					const source: CoverageSource = {
						id: selectedFile.fsPath,
						name: path.basename(
							selectedFile.fsPath
						),
						filePath:
							selectedFile.fsPath,
						color:
							existingSource?.color ??
							getCoverageColor(
								selectedFile.fsPath
							),
						enabled:
							existingSource?.enabled ??
							true,
						coverage
					};

					store.add(source);

					refreshSourcesAndVisualization();

					vscode.window.showInformationMessage(
						`Loaded ${source.name}. ` +
							`Total coverage sources: ${store.size}`
					);

					console.log(
						'Loaded coverage sources:',
						store.getAll()
					);

					/*
					 * Ask for path mapping only once.
					 */
					if (!pathMapping) {
						await configureMapping();

						if (!pathMapping) {
							vscode.window.showWarningMessage(
								'Coverage file loaded, but path mapping was not configured.'
							);

							return;
						}

						console.log(
							'Configured path mapping:',
							pathMapping
						);
					}

					refreshVisualization();
				} catch (error) {
					vscode.window.showErrorMessage(
						`Failed to load coverage file "${selectedFile.fsPath}": ${error}`
					);

					console.error(
						'Failed to load coverage file:',
						error
					);
				}
			}
		);

	/*
	 * Toggle Coverage Source
	 */
	const toggleCoverageSourceCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.toggleCoverageSource',
			(argument: unknown) => {
				const sourceId = getCoverageSourceId(argument);
				if (sourceId === undefined) { return; }
				store.toggle(sourceId);

				refreshSourcesAndVisualization();
			}
		);

	/*
	 * Enable / Disable All Sources
	 */
	const enableAllCoverageSourcesCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.enableAllCoverageSources',
			() => {
				store.setAllEnabled(true);

				refreshSourcesAndVisualization();
			}
		);

	const disableAllCoverageSourcesCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.disableAllCoverageSources',
			() => {
				store.setAllEnabled(false);

				refreshSourcesAndVisualization();
			}
		);

	/*
	 * Remove Coverage Source
	 */
	const removeCoverageSourceCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.removeCoverageSource',
			(argument: unknown) => {
				const sourceId = getCoverageSourceId(argument);
				if (sourceId === undefined) { return; }
				store.remove(sourceId);

				refreshSourcesAndVisualization();
			}
		);

	/*
	 * Set Comparison Mode
	 */
	const setComparisonModeCommand =
		vscode.commands.registerCommand(
			'multi-coverage-visualization.setComparisonMode',
			async (mode: ComparisonMode) => {
				if (!isComparisonMode(mode)) {
					return;
				}
				advancedComparison.reset();

				comparisonTreeProvider.setMode(
					mode
				);

				refreshVisualization();
				await persistConfiguration(() => workspaceConfig.saveComparisonMode(mode));
			}
		);

	const setFocusSourceCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.setFocusSource',
		(sourceId: unknown) => {
			if (sourceId === null) { sourceId = undefined; }
			if (sourceId !== undefined && typeof sourceId !== 'string') { return; }
			advancedComparison.reset();
			focusSelection.select(sourceId);
			refreshVisualization();
		}
	);
	const showOnlySourceCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.showOnlyCoverageSource',
		(argument: unknown) => {
			const sourceId = getCoverageSourceId(argument);
			if (sourceId === undefined) { return; }
			store.enableOnly(sourceId);
			refreshSourcesAndVisualization();
		}
	);

	const updateDisplay = async (key: DisplayOptionKey, enabled: boolean) => {
		displayTreeProvider.setOption(key, enabled);
		refreshVisualization(true);
		const options = displayTreeProvider.getOptions();
		await persistConfiguration(() => workspaceConfig.saveDisplayOptions(options));
	};
	const toggleDisplayCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.toggleDisplayOption',
		(key: unknown) => {
			if (!isDisplayOptionKey(key)) { return; }
			return updateDisplay(key, !displayTreeProvider.getOptions()[key]);
		}
	);
	const displayCheckboxListener = displayTreeView.onDidChangeCheckboxState(async event => {
		for (const [item, state] of event.items) {
			await updateDisplay(item.option, state === vscode.TreeItemCheckboxState.Checked);
		}
	});

	/*
	 * Automatically refresh coverage when
	 * the user switches editor tabs/files.
	 */
	const editorChangeListener =
		vscode.window.onDidChangeActiveTextEditor(
			() => {
				refreshVisualization();
			}
		);
	const visibleEditorsListener = vscode.window.onDidChangeVisibleTextEditors(() => {
		refreshVisualization(true);
	});

	context.subscriptions.push(
		...advancedCommands,
		advancedTreeView,
		advancedTreeProvider,
		configureMappingCommand,
		loadCoverageCommand,
		toggleCoverageSourceCommand,
		enableAllCoverageSourcesCommand,
		disableAllCoverageSourcesCommand,
		removeCoverageSourceCommand,
		setComparisonModeCommand,
		setFocusSourceCommand,
		showOnlySourceCommand,
		toggleDisplayCommand,
		displayCheckboxListener,
		displayTreeView,
		displayTreeProvider,
		editorChangeListener,
		visibleEditorsListener,
		coverageTreeView,
		comparisonTreeView,
		currentFileTreeView,
		currentFileTreeProvider,
		focusSourceTreeView,
		focusSourceTreeProvider,
		coverageTreeProvider,
		comparisonTreeProvider,
		{
			dispose: () =>
				decorationManager.dispose()
		},
		{
			dispose: () =>
				markerManager.dispose()
		}
	);
	refreshVisualization();
}

export function deactivate() {}
