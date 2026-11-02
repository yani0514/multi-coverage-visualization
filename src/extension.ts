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
import { CoverageTreeItem } from './sidebar/coverageTreeItem';
import { ComparisonTreeProvider } from './sidebar/comparisonTreeProvider';
import { CurrentFileTreeProvider } from './sidebar/currentFileTreeProvider';
import { analyzeCurrentFile } from './coverage/coverageAnalysis';
import { FocusSourceSelection } from './coverage/focusSourceSelection';
import { FocusSourceTreeProvider } from './sidebar/focusSourceTreeProvider';

export function activate(
	context: vscode.ExtensionContext
) {
	console.log(
		'========== MULTI COVERAGE EXTENSION ACTIVATED =========='
	);

	const store = new CoverageStore();
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
			getFocusSourceId: () => focusSelection.getSourceId()
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

	const refreshSources = () => {
		coverageTreeProvider.refresh();
		updateSourceContext();
	};

	const refreshVisualization = () => {
		const focusId = focusSelection.getSourceId();
		focusSourceTreeProvider.update(store.getAll(), focusId);
		comparisonTreeProvider.setFocusSource(focusId);
		const snapshot = renderer.refreshActiveEditor();
		currentFileTreeProvider.update(analyzeCurrentFile(snapshot));
	};

	const refreshSourcesAndVisualization =
		() => {
			refreshSources();
			refreshVisualization();
		};

	updateSourceContext();

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
			(sourceId: string) => {
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
			(item: CoverageTreeItem | string) => {
				const sourceId = typeof item === 'string'
					? item
					: item.source.id;
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
			focusSelection.select(sourceId);
			refreshVisualization();
		}
	);
	const showOnlySourceCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.showOnlyCoverageSource',
		(item: CoverageTreeItem | string) => {
			const sourceId = typeof item === 'string' ? item : item?.source.id;
			if (typeof sourceId !== 'string') { return; }
			store.enableOnly(sourceId);
			refreshSourcesAndVisualization();
		}
	);

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

	context.subscriptions.push(
		configureMappingCommand,
		loadCoverageCommand,
		toggleCoverageSourceCommand,
		enableAllCoverageSourcesCommand,
		disableAllCoverageSourcesCommand,
		removeCoverageSourceCommand,
		setComparisonModeCommand,
		setFocusSourceCommand,
		showOnlySourceCommand,
		editorChangeListener,
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
