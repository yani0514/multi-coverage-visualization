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
  source to remove it.
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

Right-click a Coverage Sources row and select **Show Only This Source** to enable
that run and disable every other run. This does not select a focus. An existing
focus remains only if its run is still enabled. Enable All and Disable All remain
available in the Coverage Sources **...** menu.

## Commands

| Command | Description |
| --- | --- |
| `Multi Coverage: Load Coverage File` | Load or reload a coverage JSON file |
| `Multi Coverage: Toggle Coverage Source` | Enable or disable a source |
| `Multi Coverage: Enable All Coverage Sources` | Enable every loaded source |
| `Multi Coverage: Disable All Coverage Sources` | Disable every loaded source |
| `Multi Coverage: Remove Coverage Source` | Unload a source |
| `Multi Coverage: Set Comparison Mode` | Switch comparison mode |
| `Multi Coverage: Configure Path Mapping` | Replace the workspace's coverage and local roots |
| `Show Only This Source` | Source context action: enable this run and disable the others |

## Workspace configuration

Path mapping and the selected comparison mode are saved for the current workspace.
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
Additional Display views can use separate providers
without changing parsing or mixing display options with comparison rules.

```bash
npm install
npm run check-types
npm run lint
npm run compile
npm test
```

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
- Display toggles are planned but not implemented yet.
- Coverage is read from the aggregated JSON format where each file path maps to
  an object of covered line numbers.
