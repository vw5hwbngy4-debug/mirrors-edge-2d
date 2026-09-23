# SpawnMap.ai — Image to Tactical Ops Map Archive

This repository preserves my SpawnMap.ai / TO-GPT experiment: turning a visual reference into a playable Unreal Engine 1 / Tactical Ops map, then exposing the resulting artifact in a browser-based map viewer.

The central artifact is **TO-GPT-SuzhouCanal-GraffitiFruit-v3**. The repository includes the compiled `.unr` map, its `.t3d` source, browser-viewable scene/map data, provenance information, iteration records, and archived runtime/telemetry evidence.

## Play / explore in the browser

GitHub Pages: **https://vw5hwbngy4-debug.github.io/image-to-unreal-map/**

The browser presentation is static. Historical runtime telemetry remains part of the archive, but the old Hostinger PHP server-status and live-telemetry bridges are not expected to operate on GitHub Pages.

## Repository highlights

- `maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.unr` — compiled Tactical Ops map
- `maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d` — Unreal text map source
- `provenance.json` — artifact provenance metadata
- `data/map-iterations.json` — preserved map iteration information
- `data/runtime-eval-001-v011.json` — archived runtime evaluation
- `viewer/` — browser map/viewer implementation
- `media/` — overview and presentation media

## GitHub Pages migration

This archive was migrated from the former `madefromchat.wolken.page/games/image-to-unreal-map/` deployment. Absolute site paths were changed to the GitHub Pages project path `/image-to-unreal-map/`; the map artifacts and browser viewer were otherwise preserved.

The PHP files are retained as historical source only. GitHub Pages is static hosting and does not execute PHP.

## Historical context

SpawnMap was an experiment in using GPT-assisted generation and iteration to bridge a visual idea and an actual playable UE1/Tactical Ops artifact. The Suzhou Canal map is preserved here so the result is not dependent on the original paid hosting.

## Rights

This repository is an archival/research project. Tactical Ops, Unreal Engine, and any third-party game assets or maps remain the property of their respective rights holders. Check redistribution rights before mirroring third-party material elsewhere.
