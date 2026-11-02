import * as assert from 'assert';
import * as path from 'path';
import type { Memento } from 'vscode';
import { WorkspaceConfig, isAbsoluteCoverageRoot } from '../config/workspaceConfig';
import { DEFAULT_DISPLAY_OPTIONS, DisplayOptions } from '../editor/displayOptions';

class MemoryState implements Memento {
	readonly values = new Map<string, unknown>();
	failWrites = false;
	keys(): readonly string[] { return [...this.values.keys()]; }
	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}
	async update(key: string, value: unknown): Promise<void> {
		if (this.failWrites) {
			throw new Error('Storage unavailable');
		}
		this.values.set(key, JSON.parse(JSON.stringify(value)) as unknown);
	}
}

suite('Workspace configuration', () => {
	test('display defaults are both enabled', () => {
		assert.deepStrictEqual(new WorkspaceConfig(new MemoryState()).getDisplayOptions(), DEFAULT_DISPLAY_OPTIONS);
	});

	test('all display combinations survive manager recreation without leaking to other workspaces', async () => {
		const state = new MemoryState();
		for (const backgroundHighlights of [true, false]) {
			for (const coverageMarkers of [true, false]) {
				const options = { backgroundHighlights, coverageMarkers };
				await new WorkspaceConfig(state).saveDisplayOptions(options);
				assert.deepStrictEqual(new WorkspaceConfig(state).getDisplayOptions(), options);
				assert.deepStrictEqual(new WorkspaceConfig(new MemoryState()).getDisplayOptions(), DEFAULT_DISPLAY_OPTIONS);
			}
		}
	});

	test('malformed display values fall back per preference without treating false as missing', () => {
		const state = new MemoryState();
		const config = new WorkspaceConfig(state);
		for (const invalid of [null, [], 'false', 0, {}, { backgroundHighlights: 'false', coverageMarkers: 0 }]) {
			state.values.set('multiCoverage.displayOptions', invalid);
			assert.deepStrictEqual(config.getDisplayOptions(), DEFAULT_DISPLAY_OPTIONS);
		}
		state.values.set('multiCoverage.displayOptions', { backgroundHighlights: false, coverageMarkers: 'bad' });
		assert.deepStrictEqual(config.getDisplayOptions(), { backgroundHighlights: false, coverageMarkers: true });
		state.values.set('multiCoverage.displayOptions', { coverageMarkers: false });
		assert.deepStrictEqual(config.getDisplayOptions(), { backgroundHighlights: true, coverageMarkers: false });
	});

	test('display reads return copies and invalid writes or failed storage are rejected', async () => {
		const state = new MemoryState();
		const config = new WorkspaceConfig(state);
		await config.saveDisplayOptions({ backgroundHighlights: false, coverageMarkers: false });
		config.getDisplayOptions().backgroundHighlights = true;
		assert.strictEqual(config.getDisplayOptions().backgroundHighlights, false);
		await assert.rejects(config.saveDisplayOptions({ backgroundHighlights: 'false', coverageMarkers: true } as unknown as DisplayOptions), /boolean/);
		state.failWrites = true;
		await assert.rejects(config.saveDisplayOptions({ ...DEFAULT_DISPLAY_OPTIONS }), /Storage unavailable/);
		assert.deepStrictEqual(config.getDisplayOptions(), { backgroundHighlights: false, coverageMarkers: false });
	});

	const mapping = { coverageRoot: '/remote/project', localRoot: path.resolve('local-project') };

	test('missing state uses no mapping and Combined', () => {
		const config = new WorkspaceConfig(new MemoryState());
		assert.strictEqual(config.getPathMapping(), undefined);
		assert.strictEqual(config.getComparisonMode(), 'combined');
	});

	test('a fresh manager restores saved mapping and every comparison mode', async () => {
		const state = new MemoryState();
		const config = new WorkspaceConfig(state);
		await config.savePathMapping(mapping);
		for (const mode of ['combined', 'shared', 'exclusive'] as const) {
			await config.saveComparisonMode(mode);
			const restarted = new WorkspaceConfig(state);
			assert.deepStrictEqual(restarted.getPathMapping(), mapping);
			assert.strictEqual(restarted.getComparisonMode(), mode);
		}
	});

	test('reconfiguration replaces roots without changing comparison or another workspace', async () => {
		const config = new WorkspaceConfig(new MemoryState());
		const other = new WorkspaceConfig(new MemoryState());
		await config.saveComparisonMode('shared');
		await config.savePathMapping(mapping);
		const replacement = { coverageRoot: '/new/root', localRoot: path.resolve('new-project') };
		await config.savePathMapping(replacement);
		assert.deepStrictEqual(config.getPathMapping(), replacement);
		assert.strictEqual(config.getComparisonMode(), 'shared');
		assert.strictEqual(other.getPathMapping(), undefined);
		assert.strictEqual(other.getComparisonMode(), 'combined');
	});

	test('malformed saved values safely fall back', () => {
		const state = new MemoryState();
		const config = new WorkspaceConfig(state);
		for (const invalid of [null, 1, 'mapping', [], {},
			{ coverageRoot: '/remote', localRoot: 1 },
			{ coverageRoot: 'relative', localRoot: mapping.localRoot },
			{ coverageRoot: '/remote', localRoot: 'relative' },
			{ coverageRoot: '/remote\0', localRoot: mapping.localRoot }]) {
			state.values.set('multiCoverage.pathMapping', invalid);
			assert.strictEqual(config.getPathMapping(), undefined);
		}
		for (const invalid of [null, 'common', 'Shared', {}, 3]) {
			state.values.set('multiCoverage.comparisonMode', invalid);
			assert.strictEqual(config.getComparisonMode(), 'combined');
		}
	});

	test('mapping reads do not expose mutable stored objects', async () => {
		const config = new WorkspaceConfig(new MemoryState());
		await config.savePathMapping(mapping);
		config.getPathMapping()!.coverageRoot = '/changed';
		assert.deepStrictEqual(config.getPathMapping(), mapping);
	});

	test('invalid writes and storage failures are reported to the caller', async () => {
		const state = new MemoryState();
		const config = new WorkspaceConfig(state);
		await config.savePathMapping(mapping);
		await assert.rejects(config.savePathMapping({ ...mapping, coverageRoot: 'relative' }), /absolute/);
		await assert.rejects(config.saveComparisonMode('common' as never), /Unknown/);
		state.failWrites = true;
		await assert.rejects(config.savePathMapping({ ...mapping, coverageRoot: '/new' }), /Storage unavailable/);
		assert.deepStrictEqual(config.getPathMapping(), mapping);
	});

	test('coverage roots can come from POSIX or Windows environments', () => {
		for (const root of ['/remote', '/', 'C:\\coverage', '\\\\server\\share']) {
			assert.ok(isAbsoluteCoverageRoot(root));
		}
		for (const root of ['', '  ', 'relative', 'C:relative', '\\relative', '/bad\0']) {
			assert.ok(!isAbsoluteCoverageRoot(root));
		}
	});
});
