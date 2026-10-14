import * as vscode from 'vscode';
import * as path from 'path';

import { parseCoverageFile } from './coverage/parser';
import { CoverageStore } from './coverage/coverageStore';
import { CoverageQuery } from './coverage/coverageQuery';
import { PathResolver } from './paths/pathResolver';
import { PathMapping } from './paths/pathMapping';

export function activate(context: vscode.ExtensionContext) {
	console.log('========== MULTI COVERAGE EXTENSION ACTIVATED ==========');

	const store = new CoverageStore();
	const query = new CoverageQuery(store);
	const pathResolver = new PathResolver();

	let pathMapping: PathMapping | undefined;

	const loadCoverageCommand = vscode.commands.registerCommand(
		'multi-coverage-visualization.loadCoverage',
		async () => {
			const files = await vscode.window.showOpenDialog({
				canSelectMany: false,
				openLabel: 'Load Coverage File',
				filters: {
					'JSON Coverage Files': ['json']
				}
			});

			if (!files || files.length === 0) {
				return;
			}

			const selectedFile = files[0];

			try {
				const coverage = await parseCoverageFile(
					selectedFile.fsPath
				);

				const source = {
					id: selectedFile.fsPath,
					name: path.basename(selectedFile.fsPath),
					filePath: selectedFile.fsPath,
					coverage
				};

				store.add(source);

				vscode.window.showInformationMessage(
					`Loaded ${source.name}. Total coverage sources: ${store.size}`
				);

				console.log(
					'Loaded coverage sources:',
					store.getAll()
				);

				// Ask for the path mapping only once.
				if (!pathMapping) {
					pathMapping = await askForPathMapping();

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

				const editor = vscode.window.activeTextEditor;

				if (!editor) {
					console.log(
						'No source file is currently open in the editor.'
					);

					return;
				}

				const localPath = editor.document.uri.fsPath;

				console.log(
					'Currently opened local file:',
					localPath
				);

				const coveragePaths = getAllCoveragePaths(store);

				const matchedCoveragePath =
					pathResolver.resolveCoveragePath(
						localPath,
						coveragePaths,
						pathMapping
					);

				console.log(
					'Matched coverage path:',
					matchedCoveragePath
				);

				if (!matchedCoveragePath) {
					vscode.window.showWarningMessage(
						`No coverage entry found for ${path.basename(localPath)}.`
					);

					return;
				}

				const fileCoverage =
					query.getCoverageForFile(
						matchedCoveragePath
					);

				console.log(
					`Whole-file coverage for ${path.basename(localPath)}:`
				);

				for (const [line, sources] of fileCoverage) {
					console.log(
						line,
						sources.map(
							coverageSource =>
								coverageSource.name
						)
					);
				}
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to load coverage file: ${error}`
				);

				console.error(
					'Failed to load coverage file:',
					error
				);
			}
		}
	);

	context.subscriptions.push(
		loadCoverageCommand
	);
}

async function askForPathMapping(): Promise<PathMapping | undefined> {
	const coverageRoot = await vscode.window.showInputBox({
		title: 'Coverage Root',
		prompt:
			'Enter the root path used inside the coverage JSON.',
		placeHolder:
			'/var/www/html/addressbook',
		ignoreFocusOut: true
	});

	if (!coverageRoot) {
		return undefined;
	}

	const localRootSelection =
		await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Local Project Root',
			title: 'Select the local project root'
		});

	if (
		!localRootSelection ||
		localRootSelection.length === 0
	) {
		return undefined;
	}

	return {
		coverageRoot,
		localRoot: localRootSelection[0].fsPath
	};
}

function getAllCoveragePaths(
	store: CoverageStore
): string[] {
	const paths = new Set<string>();

	for (const source of store.getAll()) {
		for (const coveragePath of source.coverage.keys()) {
			paths.add(coveragePath);
		}
	}

	return Array.from(paths);
}

export function deactivate() {}