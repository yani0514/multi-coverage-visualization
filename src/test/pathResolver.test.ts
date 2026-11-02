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

	test('drive-root mapping retains its slash and Windows casing behavior', () => {
		assert.strictEqual(resolver.resolveCoveragePath('c:\\edit.php', ['/remote/edit.php'], {
			localRoot: 'C:\\', coverageRoot: '/remote'
		}), '/remote/edit.php');
	});

	test('UNC roots and relative paths use Windows case-insensitive matching', () => {
		assert.strictEqual(resolver.resolveCoveragePath('\\\\server\\share\\PROJECT\\EDIT.php', ['/remote/edit.php'], {
			localRoot: '\\\\SERVER\\SHARE\\project', coverageRoot: '/remote'
		}), '/remote/edit.php');
		assert.strictEqual(resolver.resolveCoveragePath('C:/PROJECT/INCLUDE/Header.inc', ['/remote/include/header.inc'], {
			localRoot: 'c:\\project', coverageRoot: '/remote'
		}), '/remote/include/header.inc');
	});

	test('case-ambiguous POSIX coverage files are not guessed on Windows', () => {
		assert.strictEqual(resolver.resolveCoveragePath('C:/project/edit.php', ['/remote/edit.php', '/remote/Edit.php'], {
			localRoot: 'C:/project', coverageRoot: '/remote'
		}), undefined);
	});

	test('dot segments cannot escape either configured root', () => {
		const mapping = { localRoot: 'C:/project', coverageRoot: '/remote' };
		assert.strictEqual(resolver.resolveLocalPath('/remote/../outside.php', mapping), undefined);
		assert.strictEqual(resolver.resolveCoveragePath('C:/project/../outside.php', ['/remote/../outside.php'], mapping), undefined);
		assert.strictEqual(resolver.resolveCoveragePath('C:/project/src/../edit.php', ['/remote/edit.php'], mapping), '/remote/edit.php');
	});

	test('POSIX root mappings and Unicode names resolve without fuzzy matching', () => {
		assert.strictEqual(resolver.resolveCoveragePath('/project/üñî/edit.php', ['/üñî/edit.php'], {
			localRoot: '/project', coverageRoot: '/'
		}), '/üñî/edit.php');
		assert.strictEqual(resolver.resolveCoveragePath('/üñî/edit.php', ['/remote/üñî/edit.php'], {
			localRoot: '/', coverageRoot: '/remote'
		}), '/remote/üñî/edit.php');
	});
});
