# Multi Coverage Visualization

A VS Code extension for loading multiple code coverage JSON files and comparing
them directly in the editor.

Each coverage file is treated as an independent coverage source. Sources receive
a stable color, so the same color is used in the sidebar, the line background,
and the multi-source markers.

## Features

- Load multiple coverage JSON files successively, one file per source.
- Stable, deterministic color assignment per coverage source.
- Background highlighting for covered lines in `.php`, `.inc`, and other text
  files.
- Colored end-of-line markers showing which sources cover a shared line.
- Hover information describing every source that covers a marked line.
- Enable or disable individual coverage sources from the sidebar.
- Compare sources using three modes:

  | Mode | Visible lines |
  | --- | --- |
  | Combined | Covered by at least one enabled source |
  | Shared | Covered by two or more enabled sources |
  | Exclusive | Covered by exactly one enabled source |

- Automatic refresh when switching editor tabs or changing the comparison mode.

## Getting started

1. Open the **Multi Coverage** view in the Activity Bar.
2. Use **Load Coverage File** in the **Coverage Sources** view title.
3. When prompted, enter the root path used inside the coverage JSON and select
   the matching local project root. For example:
   - Coverage root: `/var/www/html/addressbook`
   - Local root: `C:\Users\...\addressbook`
4. Open a source file. Covered lines are highlighted automatically.
5. Use the **Comparison** view to switch between Combined, Shared, and Exclusive
   coverage.
6. Click a source in **Coverage Sources** to enable or disable it. The editor and
   all comparison modes update immediately.

Coverage line `0` is ignored, and coverage line numbers are converted from
1-based JSON lines to 0-based editor lines.

## Sidebar

- **Coverage Sources** lists every loaded JSON file. A filled colored circle means
  the source is enabled; an outlined circle means it is disabled. Right-click a
  source for **Show Only This Source**, **Focus This Source** (enabled runs only),
  or **Remove Source**. The view toolbar provides Load, Enable All, and Disable All;
  path configuration remains in the **...** menu. Source icons and marker dots
  have light/dark outlines so their shape remains visible across themes. Source
  colors and background opacity are unchanged.
- **Comparison** selects which lines are visible. The selected mode applies to
  both background highlights and overlap markers.
- **Focus Source** selects one enabled run or **None**. With a focus, Comparison
  offers **Covered by Focus**, **Exclusive to Focus**, and **Shared with Focus**.
  These show that run's lines, its lines covered by no other enabled run, or its
  lines also covered by at least one other enabled run. Choosing None restores
  global comparison. The comparison intent is retained when focus changes:
  Combined becomes Covered by Focus, Shared becomes Shared with Focus, and
  Exclusive becomes Exclusive to Focus. Disabling or removing the focused run
  resets focus to None; enabling it again does not restore focus automatically.
- **Current File** shows the mapped file, a covered-line count for every enabled
  source, and Combined (at least one source), Shared (at least two), and Exclusive
  (exactly one) totals. A run without that file shows `0 lines`. Counts exclude
  line `0` and include positive coverage lines beyond the editor's length, so
  totals describe the loaded data. All three totals remain visible regardless
  of the selected Comparison mode. Switching files, changing mapping, or changing
  sources updates the view automatically; unmapped files clear the old statistics.
  These global totals are unchanged by focus selection.
- **Display** independently toggles **Background Highlights** and **Coverage
  Markers** using native checkboxes. Both start enabled. Turning both off hides
  coverage decorations while keeping loaded data, focus, comparison, and Current
  File counts intact. Markers still represent multi-source lines only; disabling
  backgrounds does not create markers for lines covered by just one source.
- **Advanced Comparison** (initially collapsed) offers pairwise analysis and a
  command-driven N-of-M filter. **Comparison / Focus** returns to standard analysis.

### Advanced comparison

Choose **Pairwise Comparison** in the Advanced Comparison view (or run **Multi
Coverage: Configure Pairwise Comparison**). Pick two distinct enabled runs for
Source A and Source B. Click either source row to change it, then select:

| Operation | Visible coverage |
| --- | --- |
| Both | A ∩ B |
| Only A | A \\ B |
| Only B | B \\ A |
| A or B | A ∪ B |

Other enabled runs do not affect pairwise filtering, colors, markers, or hovers.
Fewer than two enabled runs makes pairwise configuration unavailable. Disabling
or removing either selected run clears the pair and returns to standard analysis.
Missing coverage for a file in one run is treated as an empty set for that file.

Choose **N-of-M Filter** (or **Multi Coverage: Configure N-of-M Filter**) to select
**at least N** or **exactly N**, then enter N between 1 and the number of enabled
runs. This counts all enabled runs, including runs with no coverage for the current
file. If fewer than N remain enabled, the filter resets to standard analysis.

Advanced analysis replaces, rather than stacks with, standard comparison/focus
filtering. Focus and comparison selections are retained. Select **Comparison /
Focus**, a regular Comparison mode, or a Focus Source to return to standard
analysis. Current File always shows global statistics, and Display controls still
apply. Cancelling a picker leaves the current analysis unchanged. Pair selections
and N-of-M rules are session-only, like the loaded coverage sources.

Right-click a Coverage Sources row and select **Show Only This Source** to enable
that run and disable every other run. This does not select a focus. An existing
focus remains only if its run is still enabled. Enable All and Disable All are
available in the Coverage Sources toolbar.

## Commands

| Command | Description |
| --- | --- |
| `Multi Coverage: Load Coverage File` | Load or reload a coverage JSON file |
| `Multi Coverage: Toggle Coverage Source` | Enable or disable a source |
| `Multi Coverage: Enable All Sources` | Enable every loaded source |
| `Multi Coverage: Disable All Sources` | Disable every loaded source |
| `Multi Coverage: Remove Source` | Source context action: unload a source |
| `Multi Coverage: Set Comparison Mode` | Switch comparison mode |
| `Multi Coverage: Configure Path Mapping` | Replace the workspace's coverage and local roots |
| `Show Only This Source` | Source context action: enable this run and disable the others |
| `Focus This Source` | Source context action: focus an enabled run |

## Workspace configuration

Path mapping, the selected comparison mode, and both Display preferences are saved
for the current workspace. Missing or malformed Display values default to enabled
independently for each preference.
When reopening that workspace, the Comparison view restores its selection. Load
the coverage JSON files again to render coverage using the saved mapping; the
mapping prompt appears only if no valid mapping is saved.

Run **Multi Coverage: Configure Path Mapping** from the Command Palette or the
Coverage Sources view's **...** menu to replace the mapping. Current values are
prefilled, cancelling preserves them, and a completed change refreshes the editor
immediately. If saving fails, a warning explains that the change is session-only.

Loaded JSON paths, coverage data, and source enabled states are not persisted.
Focus Source is also session-only and starts at None; only the base comparison
intent is saved, so no unloaded source ID is restored after a restart.
This keeps reloads explicit so old coverage runs and unavailable network files
are not automatically opened on startup. Sources start enabled when loaded in a
new session; reloading an existing source within a session retains its state.
No prompts or coverage-file reads occur during activation.

## Development

The native sidebar has independent source and comparison tree providers.
`EditorCoverageRenderer` resolves the current file, queries raw coverage, removes
disabled sources, and applies `comparisonFilter` before passing the same derived
coverage to both decoration managers. Filtering never changes the stored maps.
Display preferences are applied only after comparison/focus filtering and never
change the coverage snapshot used for statistics.

```bash
npm install
npm run check-types
npm run lint
npm run compile
npm test
npm run test:unit
```

### Algorithmic benchmark

Run `npm run benchmark` for deterministic small, medium, and large synthetic
coverage datasets. It reports median timings after 3 warmups and 20 repetitions,
including parsing one JSON run, queries, comparisons, statistics, and equivalent
pure marker grouping. It does not measure VS Code rendering or FPS. Temporary
datasets are cleaned automatically; benchmark tooling is excluded from the VSIX.
For a quick run use `npm run benchmark -- --scale=small`.

Press `F5` in VS Code to launch the extension development host.

### Manual comparison check

1. Load two JSON files covering the same mapped file: A covers `1,2,3,5`,
   B covers `2,3,4,5`.
2. Check Combined shows `1,2,3,4,5`, Shared shows `2,3,5`, and Exclusive
   shows `1,4`. Shared lines should retain both colored markers and their hover.
3. Disable B. Combined and Exclusive should show `1,2,3,5`; Shared should be empty.
4. Disable every source and confirm all highlights and markers disappear.
5. Re-enable sources and switch between mapped `.php` and `.inc` files. The
   comparison selection should stay active without reloading JSON files.
6. Reload the same JSON file and confirm it replaces its entry while retaining
   its color and enabled state. Right-click a source and check Remove works.
7. Include line `0` and a line beyond the file length; neither should render.

## Current limitations

- Loaded coverage sources and their enabled states are session-scoped.
- Coverage is read from the aggregated JSON format where each file path maps to
  an object of covered line numbers.
