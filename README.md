<div align="center">
  <img src=".tracker/static/img/logo.svg" alt="Modulwerk Logo" width="84" height="84" />
  <h1>Modulwerk</h1>
  <p><strong>A modern, universal, privacy-first academic workspace & exercise tracking system.</strong></p>
  <p>
    <em>Zero Dependencies · Zero Build Tools · 100% Local · Cross-Platform (Windows, macOS, Linux)</em>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#universal-folder-structure">Folder Structure</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#license">License</a>
  </p>
</div>

---

## 🌟 Overview

**Modulwerk** is a lightweight, local-first academic homework and exercise manager designed for university, college, and school students. Whether you are studying Computer Science, Mathematics, Physics, Engineering, or Medicine, Modulwerk helps you stay on top of weekly problem sheets (*Übungsblätter*), mandatory assignments (*Hausaufgaben*), and solutions (*Lösungen*).

Unlike bloated web platforms, Modulwerk requires **no `npm`**, **no `node_modules`**, and **no build steps**. A single command or double-click starts an instant local micro-server and opens a sleek Linear/Raycast-inspired dashboard in your default browser.

---

## ✨ Features

- **🌐 100% Cross-Platform (Windows, macOS, Linux)**:
  - **macOS & Linux**: Native Python 3 standard-library micro-server (`Modulwerk.sh`).
  - **Windows**: Dual-engine runner (`Modulwerk.bat`) supporting built-in PowerShell or Python.
  - Zero external package requirements (zero `npm`, zero `pip`).
- **📁 Dynamic & Universal Course Detection**:
  - Automatically discovers ANY subject directory (`Math`, `Algorithms`, `Physics`, `Analysis`, etc.).
  - Adapts to nested sheets (`Subject/Sheet_01/`), flat folders (`Subject/HW1.pdf`), or root files.
  - Flexible sheet numbering detection: `Sheet 01`, `Blatt 02`, `Week 03`, `HW 4`, `Assignment 5`, `Lab 6`.
  - Multilingual solution pairing (English, German, French: `solution`, `loesung`, `musterloesung`, `sol`, `key`).
  - Expanded file formats: `.pdf`, `.docx`, `.txt`, `.md`, `.java`, `.py`, `.c`, `.cpp`, `.ipynb`, `.zip`.
- **📂 3 Viewing Modes**:
  - **List View**: Grouped by subject with progress fractions and dynamic color accents.
  - **Tree View (Baumstruktur)**: Collapsible hierarchical folder tree (`Module → Sheet → Tasks`).
  - **Matrix View**: High-level semester completion grid displaying all sheets across all modules side-by-side with interactive drop zones.
- **🧩 Dual-Box Task Cards**: Distinguishes **Aufgabe / Exercise** and **Lösung / Solution** in a unified file-pair tile with instant in-browser viewing.
- **🎯 Direct Drag & Drop**: Drop homework or solution sheets anywhere on the window or into specific matrix cells for instant auto-categorization.
- **🧼 Filename Normalizer**: Built-in modal that scans for chaotic file naming and standardizes them into canonical schema (`[Subject]_[Category]_[Sheet].[ext]`).
- **🎛️ Command Bar & Raycast Dropdowns**:
  - Global `/` hotkey for instant search across subjects, sheets, notes, and file names.
  - Dynamic floating dropdowns for Module, Category, and Relevance.
  - Segmented status counters (`All`, `Pending`, `Completed`).
- **🔒 Privacy by Design**: 100% of your documents, code submissions, solutions, and notes stay strictly on your local disk.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/kaantemizkaan/modulwerk.git
cd modulwerk
```

### 2. Launch

#### On Windows:
Double-click **`Modulwerk.bat`** (or run `powershell -ExecutionPolicy Bypass -File .\.tracker\tracker_server.ps1`).

#### On macOS & Linux:
Run the launcher script:
```bash
chmod +x Modulwerk.sh
./Modulwerk.sh
```

Modulwerk will automatically scan your course folders, launch the local server at `http://localhost:5050/`, and open your default browser.

---

## 📁 Universal Folder Structure

Modulwerk works out of the box with any directory layout. Simply place your subject folders in the repository root:

```
my-studies/
├── Modulwerk.bat              # Windows one-click launcher
├── Modulwerk.sh               # macOS & Linux launcher
├── Modulwerk.html             # Semantic app shell
├── .tracker/                  # Micro-servers & static assets
│
├── Calculus/                  # Subject 1 (Nested format)
│   ├── Sheet_01/
│   │   ├── Calculus_Assignment_01.pdf
│   │   └── Calculus_Assignment_01_Solution.pdf
│   └── Sheet_02/
│
├── Computer Science/          # Subject 2 (Code & Project format)
│   ├── Lab_01/
│   │   ├── Problem.pdf
│   │   └── solution.py
│   └── ...
│
└── Physics/                   # Subject 3 (Flat format)
    ├── Physics_HW_01.pdf
    ├── Physics_HW_01_Solution.pdf
    └── ...
```

---

## 🏗️ Architecture

```
modulwerk/
├── Modulwerk.html            # Universal semantic HTML shell (~350 lines)
├── Modulwerk.bat             # Windows dual-engine launcher (Python / PowerShell)
├── Modulwerk.sh              # macOS & Linux launcher (POSIX / Python 3)
└── .tracker/
    ├── tracker_server.py     # Cross-platform Python 3 micro-server (Zero dependencies)
    ├── tracker_server.ps1    # Native Windows PowerShell micro-server (Built-in)
    ├── scan_homework.ps1     # Dynamic Windows PowerShell workspace scanner
    └── static/               # Zero-build modular frontend assets
        ├── css/
        │   ├── base.css          # Design tokens, themes & sleek 7px scrollbar
        │   ├── topbar.css        # Branding, stats strip & header
        │   ├── command-bar.css   # Search & segmented buttons
        │   ├── dropdown.css      # Floating dropdown menus
        │   ├── task-card.css     # Dual-box file-pair card layout
        │   ├── modals.css        # Dialogs, toasts & normalizer
        │   └── views/            # list-view.css, tree-view.css, matrix-view.css
        ├── js/
        │   ├── app.js            # Main orchestrator & dynamic module dispatcher
        │   ├── state.js          # Central reactive store & dynamic palette engine
        │   ├── api.js            # Universal REST API client
        │   ├── utils.js          # Helpers & sanitizers
        │   ├── components/       # UI component controllers
        │   └── views/            # Dynamic view rendering engines
        └── img/
            ├── logo.svg          # Vector logo (M-Monogram)
            └── logo-mark.svg     # Favicon & icon mark
```

---

## ⌨️ Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` | Focus search bar |
| `Esc` | Close any active modal, drawer, or dropdown |
| `Space` | Toggle task completion (when focused) |

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
Feel free to star ⭐️, fork, and adapt it to your university or school workflow!
