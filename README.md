# StemDeck — Pinokio launcher (unofficial)

Unofficial Pinokio installer for [StemDeck](https://github.com/stemdeckapp/stemdeck), supporting **Windows x64 / NVIDIA** and **Linux x64 / NVIDIA** (including Ubuntu).

## Install

In Pinokio use **Download from URL** and enter `https://github.com/ChrisTorng/stemdeck.pinokio`. Select **Install**, then **Start**. This launcher retrieves the latest upstream GitHub Release NVIDIA portable archive, verifies its published SHA-256 checksum, and extracts it under `app/`. StemDeck itself downloads FFmpeg, the Demucs model, and necessary runtime files on first launch. You need a writable Pinokio directory.

**Update** overlays the downloaded application while keeping `app/data/` (models and settings); back up that directory before major upgrades.

Requires Node.js 20+ in the Pinokio shell and an NVIDIA driver. This launches the native desktop GUI (not an embedded web page). On Linux you also need a running graphical desktop session. No macOS support is claimed; its upstream DMG is available independently.

## Source and license

- Upstream project: https://github.com/stemdeckapp/stemdeck
- Upstream releases: https://github.com/stemdeckapp/stemdeck/releases
- Community launcher code: MIT; upstream models/binaries have their own licenses.
- Testing: static smoke tests / simulated archive install only; not verified on the user's hardware.

This project is not affiliated with the upstream developers.
