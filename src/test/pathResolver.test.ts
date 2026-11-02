import * as assert from 'assert';
import { PathResolver } from '../paths/pathResolver';

suite('Explicit root mapping', () => {
	const resolver = new PathResolver();
	test('Windows local casing does not alter coverage-path casing', () => {
		assert.strictEqual(resolver.resolveCoveragePath(
			'c:\\project\\edit.php', ['/remote/edit.php'],
			{ localRoot: 'C:\\Project', coverageRoot: '/remote' }
		), '/remote/edit.php');
		assert.strictEqual(resolver.resolveCoveragePath(
			'c:\\project\\edit.php', ['/Remote/edit.php'],
			{ localRoot: 'C:\\Project', coverageRoot: '/remote' }
		), undefined);
	});
	test('roots match directory boundaries rather than path prefixes', () => {
		assert.strictEqual(resolver.resolveCoveragePath(
			'/project-other/edit.php', ['/remote/-other/edit.php'],
			{ localRoot: '/project', coverageRoot: '/remote' }
		), undefined);
		assert.strictEqual(resolver.resolveLocalPath(
			'/remote-other/edit.php', { localRoot: '/project', coverageRoot: '/remote' }
		), undefined);
	});
});
