/*
 * Repeatable algorithmic benchmark, separate from correctness tests.
 * Run: npm run compile-tests
 *      node --expose-gc benchmarks/coverage-benchmark.cjs
 * Optional: --scale=small|medium|large --repetitions=20 --warmups=3
 * Temporary JSON is generated outside the repository and removed on completion.
 * No VS Code renderer, IPC, layout, paint, or FPS measurements are claimed.
 */
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { parseCoverageFile } = require('../out/coverage/parser');
const { CoverageStore } = require('../out/coverage/coverageStore');
const { CoverageQuery } = require('../out/coverage/coverageQuery');
const { buildVisibleCoverage } = require('../out/coverage/comparisonFilter');
const { analyzeCurrentFile } = require('../out/coverage/coverageAnalysis');
const { PathResolver } = require('../out/paths/pathResolver');

const argumentsMap = new Map(process.argv.slice(2).map(argument => argument.replace(/^--/, '').split('=')));
const repetitions = Number(argumentsMap.get('repetitions') ?? 20);
const warmups = Number(argumentsMap.get('warmups') ?? 3);
if (!Number.isSafeInteger(repetitions) || repetitions < 1 || !Number.isSafeInteger(warmups) || warmups < 0) {
  throw new Error('Use positive integer --repetitions and non-negative integer --warmups.');
}
const datasets = [
  { name: 'small', sources: 5, files: 50, entriesPerFile: 500 },
  { name: 'medium', sources: 10, files: 100, entriesPerFile: 1000 },
  { name: 'large', sources: 20, files: 500, entriesPerFile: 2000 }
].filter(dataset => !argumentsMap.has('scale') || argumentsMap.get('scale') === dataset.name);
if (datasets.length === 0) { throw new Error('Unknown --scale. Choose small, medium, or large.'); }

let sink;
function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function measure(operation) {
  for (let index = 0; index < warmups; index++) { sink = operation(); }
  const samples = [];
  for (let index = 0; index < repetitions; index++) {
    const start = performance.now();
    sink = operation();
    samples.push(performance.now() - start);
  }
  sink = undefined;
  return median(samples);
}
async function measureAsync(operation) {
  for (let index = 0; index < warmups; index++) { sink = await operation(); }
  const samples = [];
  for (let index = 0; index < repetitions; index++) {
    const start = performance.now();
    sink = await operation();
    samples.push(performance.now() - start);
  }
  sink = undefined;
  return median(samples);
}
function sourcePath(file) { return `/remote/project/dir-${file % 10}/source-${file}.php`; }
function makeRaw(dataset, source) {
  const raw = {};
  for (let file = 0; file < dataset.files; file++) {
    const lines = {};
    const shift = (source * 97 + file * 13) % (dataset.entriesPerFile * 2);
    for (let entry = 0; entry < dataset.entriesPerFile; entry++) {
      lines[((entry + shift) % (dataset.entriesPerFile * 2)) + 1] = 1;
    }
    raw[sourcePath(file)] = lines;
  }
  return raw;
}

// Reproduces the renderer's current path collection rather than timing just lookup.
function resolveCurrentFile(store, resolver, localPath, mapping) {
  const coveragePaths = new Set();
  for (const source of store.getAll()) {
    for (const coveragePath of source.coverage.keys()) { coveragePaths.add(coveragePath); }
  }
  return resolver.resolveCoveragePath(localPath, [...coveragePaths], mapping);
}

// Equivalent pure part of MarkerManager grouping; excludes VS Code Range/hover/API work.
function groupMarkerCombinations(coverage) {
  const groups = new Map();
  const combinations = new Map();
  for (const [line, sources] of coverage) {
    if (line <= 0 || sources.length <= 1) { continue; }
    const orderedKey = JSON.stringify(sources.map(source => source.id));
    let combination = combinations.get(orderedKey);
    if (!combination) {
      const sorted = [...sources].sort((a, b) => a.id.localeCompare(b.id));
      combination = { key: JSON.stringify(sorted.map(source => source.id)), sources: sorted };
      combinations.set(orderedKey, combination);
    }
    const { key, sources: sorted } = combination;
    let group = groups.get(key);
    if (!group) { group = { sources: sorted, lines: [] }; groups.set(key, group); }
    group.lines.push(line);
  }
  return groups;
}

async function benchmarkDataset(dataset, directory) {
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const store = new CoverageStore();
  let representativeFile;
  let bytesPerSource;
  const loadStart = performance.now();
  for (let source = 0; source < dataset.sources; source++) {
    const filename = path.join(directory, `${dataset.name}-${source}.json`);
    const json = JSON.stringify(makeRaw(dataset, source));
    await fs.writeFile(filename, json);
    representativeFile ??= filename;
    bytesPerSource ??= Buffer.byteLength(json);
    const coverage = await parseCoverageFile(filename);
    store.add({ id: filename, filePath: filename, name: `${source}.json`, color: 'rgba(1,2,3,0.2)', enabled: true, coverage });
  }
  const generateWriteParseStoreMs = performance.now() - loadStart;
  const sources = store.getAll();
  const sourceA = sources[0].id;
  const sourceB = sources[1].id;
  const query = new CoverageQuery(store);
  const resolver = new PathResolver();
  const coveragePath = sourcePath(dataset.files - 1);
  const mapping = { coverageRoot: '/remote/project', localRoot: path.join(directory, 'local') };
  const relative = coveragePath.slice(mapping.coverageRoot.length + 1);
  const localPath = path.join(mapping.localRoot, ...relative.split('/'));
  const raw = query.getCoverageForFile(coveragePath);
  const combined = buildVisibleCoverage(raw, 'combined');
  const snapshot = { state: 'mapped', localPath, coveragePath, coverage: raw, sources };
  global.gc?.();
  const retainedHeapMiB = (process.memoryUsage().heapUsed - heapBefore) / 2 ** 20;
  const parseFileMs = await measureAsync(() => parseCoverageFile(representativeFile));
  const timings = {
    parseFileMs,
    addAllSourcesMs: measure(() => { const target = new CoverageStore(); for (const source of sources) { target.add(source); } return target.size; }),
    collectAndResolveMs: measure(() => resolveCurrentFile(store, resolver, localPath, mapping)),
    queryMs: measure(() => query.getCoverageForFile(coveragePath)),
    combinedMs: measure(() => buildVisibleCoverage(raw, 'combined')),
    sharedMs: measure(() => buildVisibleCoverage(raw, 'shared')),
    exclusiveMs: measure(() => buildVisibleCoverage(raw, 'exclusive')),
    focusCoveredMs: measure(() => buildVisibleCoverage(raw, 'combined', sourceA)),
    focusSharedMs: measure(() => buildVisibleCoverage(raw, 'shared', sourceA)),
    focusExclusiveMs: measure(() => buildVisibleCoverage(raw, 'exclusive', sourceA)),
    pairwiseBothMs: measure(() => buildVisibleCoverage(raw, 'combined', undefined, { kind: 'pairwise', sourceA, sourceB, operation: 'both' })),
    pairwiseOnlyAMs: measure(() => buildVisibleCoverage(raw, 'combined', undefined, { kind: 'pairwise', sourceA, sourceB, operation: 'only-a' })),
    atLeastNMs: measure(() => buildVisibleCoverage(raw, 'combined', undefined, { kind: 'multiplicity', rule: 'at-least', count: Math.ceil(dataset.sources / 2) })),
    exactlyNMs: measure(() => buildVisibleCoverage(raw, 'combined', undefined, { kind: 'multiplicity', rule: 'exactly', count: Math.ceil(dataset.sources / 2) })),
    statisticsMs: measure(() => analyzeCurrentFile(snapshot)),
    markerGroupingMs: measure(() => groupMarkerCombinations(combined)),
    refreshPreparationMs: measure(() => {
      const matched = resolveCurrentFile(store, resolver, localPath, mapping);
      const coverage = query.getCoverageForFile(matched);
      const visible = buildVisibleCoverage(coverage, 'combined');
      const stats = analyzeCurrentFile({ ...snapshot, coverage });
      return { stats, groups: groupMarkerCombinations(visible) };
    })
  };
  return {
    ...dataset, totalEntries: dataset.sources * dataset.files * dataset.entriesPerFile,
    representativeJsonMiB: bytesPerSource / 2 ** 20,
    currentFileUnionLines: raw.size, markerCombinations: groupMarkerCombinations(combined).size,
    retainedHeapMiB, generateWriteParseStoreMs,
    medianMilliseconds: Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Number(value.toFixed(4))]))
  };
}

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-coverage-benchmark-'));
  try {
    console.log(JSON.stringify({
      methodology: { repetitions, warmups, aggregation: 'median', timer: 'performance.now milliseconds',
        parse: 'one source JSON; includes UTF-8 filesystem read, JSON parse, validation, and Map/Set transformation; warm filesystem cache',
        setup: 'generate/write/parse/store all sources once; not a repeated timing',
        markerGrouping: 'equivalent pure grouping only, excludes Range/hover/decoration/IPC/paint',
        refreshPreparation: 'collect paths + resolve + query + Combined + statistics + pure marker grouping; no VS Code UI',
        memory: 'retained heap delta after optional explicit GC, not peak memory', explicitGc: Boolean(global.gc) },
      environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model,
        logicalCpus: os.cpus().length, totalMemoryGiB: Number((os.totalmem() / 2 ** 30).toFixed(2)) }
    }));
    for (const dataset of datasets) {
      console.log(JSON.stringify(await benchmarkDataset(dataset, directory)));
      global.gc?.();
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
