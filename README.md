<div align="center">
  <img src=".tracker/static/img/logo.svg" alt="Modulwerk Logo" width="84" height="84" />
  <h1>Modulwerk</h1>
  <p><strong>A modern, privacy-first academic workspace and exercise tracking system.</strong></p>
  <p>
    <em>Built with Native ES Modules & PowerShell · Zero Dependencies · Zero Build Tools · 100% Local</em>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#folder-structure">Folder Structure</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#license">License</a>
  </p>
</div>

---

## 🌟 Overview

**Modulwerk** is an elegant, local-first academic homework and exercise manager designed for university students. Originally crafted for the Computer Science & Statistics curriculum at **LMU Munich** (*Ludwig-Maximilians-Universität München*), it is built to help students stay on top of weekly problem sheets (*Übungsblätter*), mandatory homework assignments (*Hausaufgaben*), and solutions (*Lösungen*).

Unlike bloated web apps, Modulwerk requires **no `npm`**, **no `node_modules`**, and **no build steps**. A single click starts a local background micro-server and opens a sleek Linear/Raycast-inspired dashboard in your browser.

---

## ✨ Features

- **⚡ Zero Build & Zero Dependencies**: Runs out of the box on Windows with PowerShell and any modern browser using native ES modules.
- **📂 3 Viewing Modes**:
  - **List View**: Clean module-grouped view with progress metrics and file cards.
  - **Tree View (Baumstruktur)**: Collapsible hierarchical folder tree (`Module → Sheet → Tasks`).
  - **Matrix View**: High-level semester completion grid displaying all sheets across all modules side-by-side with interactive drop zones.
- **🧩 Dual-Box Task Cards**: Distinguishes **Aufgabendatei** (Exercise) and **Lösungsdatei** (Solution) in a unified file-pair tile with one-click viewing.
- **🎯 Drag & Drop Sorting**: Drop homework PDFs or solution sheets anywhere on the window or onto specific matrix slots for instant auto-categorization.
- **🧼 Filename Normalizer**: Built-in modal that scans for chaotic file naming and standardizes them with one click into canonical LMU schema (`[Subject]_[Category]_[Sheet].[ext]`).
- **🎛️ Command Bar & Raycast Dropdowns**:
  - Global `/` hotkey for instant search across subjects, sheets, notes, and file names.
  - Linear/Raycast-style floating dropdowns for Module, Category, and Relevance.
  - Segmented status counters (`Alle`, `Ausstehend`, `Erledigt`).
- **🔒 Privacy by Design**: 100% of your academic materials, homework submissions, and personal notes stay strictly on your local disk.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/your-username/modulwerk.git
cd modulwerk
```

### 2. Launch
Double-click **`Modulwerk.bat`** (or execute in PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\.tracker\tracker_server.ps1
```
Modulwerk will automatically scan your directory, spin up the local server at `http://localhost:5050/`, and open your default browser.

---

## 📁 Recommended Folder Structure

Organize your university course folders in the root directory alongside `Modulwerk.bat`:

```
my-studies/
├── Modulwerk.bat              # One-click launcher
├── Modulwerk.html             # Semantic app shell
├── .tracker/                  # Micro-server & static assets
│
├── Analysis/                  # Example Subject 1
│   ├── Blatt_01/
│   │   ├── Analysis_Hausaufgabe_01.pdf
│   │   └── Analysis_Hausaufgabe_01_Loesung.pdf
│   └── Blatt_02/
│
├── Computer Science/          # Example Subject 2
│   ├── Sheet_01/
│   │   └── Exercise_01.pdf
│   └── ...
│
└── Linear Algebra/            # Example Subject 3
    └── ...
```

Modulwerk automatically detects module names, sheet numbers (`Blatt 01`, `Sheet 02`), categories (*Hausaufgabe*, *Übungsblatt*, *Präsenzübung*, *Tutorium*), and linked solutions.

---

## 🏗️ Architecture

```
modulwerk/
├── Modulwerk.html            # Semantic HTML shell (~350 lines)
├── Modulwerk.bat             # Windows launcher script
└── .tracker/
    ├── tracker_server.ps1    # PowerShell HTTP server & REST API
    ├── scan_homework.ps1     # Intelligent filesystem analyzer
    └── static/               # Modular frontend assets (Zero-build ES modules)
        ├── css/
        │   ├── base.css          # Design tokens, themes & sleek 7px scrollbar
        │   ├── topbar.css        # Branding, stats strip & header
        │   ├── command-bar.css   # Search & segmented buttons
        │   ├── dropdown.css      # Floating dropdown menus
        │   ├── task-card.css     # Dual-box file-pair card layout
        │   ├── modals.css        # Dialogs, toasts & normalizer
        │   └── views/            # list-view.css, tree-view.css, matrix-view.css
        ├── js/
        │   ├── app.js            # Main orchestrator & global bindings
        │   ├── state.js          # Central reactive store (Observer pattern)
        │   ├── api.js            # REST API client
        │   ├── utils.js          # Helpers & sanitizers
        │   ├── components/       # UI component controllers
        │   └── views/            # View rendering engines
        └── img/
            ├── logo.svg          # Vector logo (M-Monogram)
            └── logo-mark.svg     # Favicon & icon mark
```

---

## ⌨️ Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` | Focus search bar |
| `Esc` | Close any active modal or dropdown |
| `Space` | Toggle task completion (when focused) |

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
Feel free to adapt it to your university or school workflow!
