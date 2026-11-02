#!/usr/bin/env python3
"""
==========================================================
  Modulwerk - Universal Academic Workspace Server
  Cross-Platform Python 3 HTTP Server & Scanner
  Zero Dependencies · Runs on Windows, macOS, and Linux
==========================================================
"""

import os
import sys
import json
import re
import base64
import mimetypes
import platform
import subprocess
import webbrowser
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path

# Paths
TRACKER_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = TRACKER_DIR.parent
HTML_FILE = WORKSPACE_ROOT / "Modulwerk.html"
if not HTML_FILE.exists():
    HTML_FILE = WORKSPACE_ROOT / "Odev_Takip.html"
DB_FILE = WORKSPACE_ROOT / "homework_db.json"
STATIC_DIR = TRACKER_DIR / "static"

SYSTEM_DIRS = {
    '.tracker', '.git', '.vscode', '.idea', 'node_modules',
    'build', 'dist', '__pycache__', 'venv', '.venv', 'temp', 'bin', 'obj'
}

SOL_REGEX = re.compile(
    r'(loesung|l[öo]sung|solution|sol|ausarbeitung|theorie|musterl[öo]sung|musterloesung|answer|key)',
    re.IGNORECASE
)

VALID_EXTS = {
    '.pdf', '.docx', '.doc', '.odt', '.txt', '.md',
    '.java', '.py', '.cpp', '.c', '.h', '.hpp', '.cs',
    '.ipynb', '.zip', '.tar.gz', '.png', '.jpg', '.jpeg', '.svg'
}


def format_file_size(bytes_num):
    if not bytes_num:
        return "0 B"
    if bytes_num >= 1048576:
        return f"{bytes_num / 1048576:.1f} MB"
    if bytes_num >= 1024:
        return f"{round(bytes_num / 1024)} KB"
    return f"{bytes_num} B"


def get_sheet_number(filename, folder_name=""):
    combined = f"{folder_name} {filename}"
    m = re.search(r'(?:blatt|sheet|week|woche|hw|homework|assignment|ueb|ex|aufgabe|serie|tp|td|lab|praktikum)[_\s-]*0*(\d+)', combined, re.IGNORECASE)
    if m:
        return f"Blatt {int(m.group(1)):02d}"
    m = re.search(r'\[(?:blatt\s*)?0*(\d+)\]', combined, re.IGNORECASE)
    if m:
        return f"Blatt {int(m.group(1)):02d}"
    m = re.search(r'(?:^|[_\s-])0*(\d{1,3})(?:[_\s\.-]|$)', filename, re.IGNORECASE)
    if m:
        return f"Blatt {int(m.group(1)):02d}"
    return "Blatt 01"


def get_category(filename, folder_name=""):
    combined = f"{folder_name} {filename}"
    if re.search(r'(?:hausaufgabe|homework|hw|abgabe|assignment|devoir|pflicht)', combined, re.IGNORECASE):
        return "Hausaufgabe"
    if re.search(r'(?:praesenz|inclass)', combined, re.IGNORECASE):
        return "Präsenzübung"
    if re.search(r'(?:praktikum|lab|tp|project|projekt)', combined, re.IGNORECASE):
        return "Praktikum"
    if re.search(r'(?:tutorium|tutorial|td|seminar)', combined, re.IGNORECASE):
        return "Tutorium"
    return "Übungsblatt"


def format_display_title(subject, cat, sheet, raw_name):
    stem = Path(raw_name).stem
    if re.match(r'^(?:ueb|ex|blatt|sheet|hw|homework|praesenz|hausaufgabe)0*(\d+)$', stem, re.IGNORECASE) or \
       re.match(r'^\d+-(?:ex|ueb|sheet|hw)$', stem, re.IGNORECASE):
        return f"{subject} {cat} ({sheet})"
    formatted = stem.replace('_', ' ')
    formatted = re.sub(r'uebungsblatt', 'Übungsblatt', formatted, flags=re.IGNORECASE)
    formatted = re.sub(r'praesenzuebung', 'Präsenzübung', formatted, flags=re.IGNORECASE)
    formatted = re.sub(r'uebung', 'Übung', formatted, flags=re.IGNORECASE)
    formatted = re.sub(r'loesung', 'Lösung', formatted, flags=re.IGNORECASE)
    formatted = re.sub(r'fu_r|fu\u0308r', 'für', formatted, flags=re.IGNORECASE)
    return formatted.strip()


def normalize_clean_string(s):
    if not s:
        return ""
    return re.sub(r'[^a-z0-9]', '', s.lower())


def scan_workspace():
    existing_db = {
        "version": "2.4",
        "last_scanned": datetime.now().isoformat(),
        "tasks": [],
        "ignored_tasks": []
    }
    if DB_FILE.exists():
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                parsed = json.load(f)
                if isinstance(parsed, dict) and "tasks" in parsed:
                    existing_db = parsed
        except Exception as e:
            print(f"Warning: could not read DB: {e}")

    ignored_task_ids = set()
    ignored_paths = set()
    for it in existing_db.get("ignored_tasks", []):
        if it.get("id"):
            ignored_task_ids.add(it["id"])
        if it.get("file_path"):
            ignored_paths.add(it["file_path"].replace('\\', '/').lower())

    user_overrides = {}
    user_overrides_by_path = {}
    custom_tasks = []
    for t in existing_db.get("tasks", []):
        if t.get("is_custom"):
            if t.get("id") not in ignored_task_ids:
                custom_tasks.append(t)
        else:
            entry = {
                "manual_status": t.get("manual_status"),
                "notes": t.get("notes", ""),
                "priority": t.get("priority", "normal"),
                "due_date": t.get("due_date"),
                "is_optional": t.get("is_optional")
            }
            if t.get("id"):
                user_overrides[t["id"]] = entry
            if t.get("file_path"):
                user_overrides_by_path[t["file_path"].replace('\\', '/').lower()] = entry

    # Detect subject folders
    top_entries = [p for p in WORKSPACE_ROOT.iterdir() if p.is_dir() and p.name not in SYSTEM_DIRS]
    subject_list = []
    if top_entries:
        for p in top_entries:
            subject_list.append({"name": p.name, "path": p})
    else:
        subject_list.append({"name": "Allgemein", "path": WORKSPACE_ROOT})

    scanned_tasks = []

    for subj_item in subject_list:
        subj = subj_item["name"]
        subj_dir = subj_item["path"]

        all_files = []
        for root, dirs, files in os.walk(subj_dir):
            # Skip slide folders
            dirs[:] = [d for d in dirs if d not in SYSTEM_DIRS and not re.match(r'^(?:vorlesung|lecture|slides|folien)$', d, re.IGNORECASE)]
            for f in files:
                ext = Path(f).suffix.lower()
                if ext in VALID_EXTS or (len(ext) > 1 and f.endswith(tuple(VALID_EXTS))):
                    all_files.append(Path(root) / f)

        # Check for multi-file praktikum/code folders
        for root, dirs, files in os.walk(subj_dir):
            d_name = os.path.basename(root)
            if re.search(r'(?:praktikum|lab|project|projekt)', d_name, re.IGNORECASE):
                code_files = [f for f in files if Path(f).suffix.lower() in {'.java', '.py', '.c', '.cpp', '.h', '.cs', '.js', '.ts'}]
                if code_files:
                    rel_folder = os.path.relpath(root, WORKSPACE_ROOT).replace('\\', '/')
                    norm_rel_folder = rel_folder.lower()
                    task_id = re.sub(r'[^a-zA-Z0-9_-]', '_', f"task-{subj}-praktikum-{d_name}")
                    if task_id in ignored_task_ids or norm_rel_folder in ignored_paths:
                        continue

                    total_size = sum(os.path.getsize(os.path.join(root, f)) for f in code_files)
                    sheet = get_sheet_number(d_name, d_name)
                    override = user_overrides.get(task_id) or user_overrides_by_path.get(norm_rel_folder)
                    auto_done = len(code_files) > 0
                    manual_status = override.get("manual_status") if override else None
                    is_completed = manual_status if manual_status is not None else auto_done
                    is_opt = override.get("is_optional", False) if override else False

                    primary_ext = Path(code_files[0]).suffix.lstrip('.').upper()
                    size_formatted = format_file_size(total_size)

                    scanned_tasks.append({
                        "id": task_id,
                        "subject": subj,
                        "category": "Praktikum",
                        "sheet": sheet,
                        "title": f"{subj} {d_name.replace('_', ' ')}",
                        "file_path": rel_folder,
                        "file_name": d_name,
                        "file_size": f"{len(code_files)} {primary_ext} files",
                        "file_ext": primary_ext,
                        "is_folder": True,
                        "solution_path": rel_folder,
                        "solution_name": f"{len(code_files)} {primary_ext} files",
                        "solution_size": size_formatted,
                        "solution_ext": primary_ext,
                        "solution_note": f"{len(code_files)} {primary_ext} files ({size_formatted})",
                        "auto_detected": auto_done,
                        "manual_status": manual_status,
                        "completed": is_completed,
                        "is_optional": is_opt,
                        "notes": override.get("notes", "") if override else "",
                        "priority": override.get("priority", "normal") if override else "normal",
                        "due_date": override.get("due_date") if override else None,
                        "is_custom": False,
                        "last_modified": datetime.fromtimestamp(os.path.getmtime(root)).isoformat()
                    })

        solution_files = [f for f in all_files if SOL_REGEX.search(f.name)]
        assignment_files = [f for f in all_files if not SOL_REGEX.search(f.name) and not re.match(r'^(?:notizen|notes|readme)', f.name, re.IGNORECASE)]

        for af in assignment_files:
            rel_file = os.path.relpath(af, WORKSPACE_ROOT).replace('\\', '/')
            norm_rel_file = rel_file.lower()
            parent_dir_name = af.parent.name
            cat = get_category(af.name, parent_dir_name)
            sheet = get_sheet_number(af.name, parent_dir_name)
            raw_title = af.stem
            display_title = format_display_title(subj, cat, sheet, af.name)
            task_id = re.sub(r'[^a-zA-Z0-9_-]', '_', f"task-{subj}-{parent_dir_name}-{raw_title}")

            if task_id in ignored_task_ids or norm_rel_file in ignored_paths:
                continue

            task_norm = normalize_clean_string(raw_title)
            matching_sols = []

            same_dir_sols = [sf for sf in solution_files if sf.parent == af.parent]
            same_dir_assignments = [a for a in assignment_files if a.parent == af.parent and get_sheet_number(a.name, a.parent.name) == sheet]
            candidates = same_dir_sols if same_dir_sols else solution_files

            for sf in candidates:
                sol_stem = sf.stem
                sol_norm = re.sub(r'(?:loesung|lsung|solution|ausarbeitung|theorie|musterlsung)', '', normalize_clean_string(sol_stem), flags=re.IGNORECASE)
                sol_sheet = get_sheet_number(sf.name, sf.parent.name)

                is_direct = (task_norm == sol_norm or
                             (len(sol_norm) >= 4 and sol_norm in task_norm) or
                             (len(task_norm) >= 4 and task_norm in sol_norm))
                cat_match = (
                    (cat == "Hausaufgabe" and re.search(r'hausaufgabe', sf.name, re.IGNORECASE)) or
                    (cat == "Präsenzübung" and re.search(r'praesenz', sf.name, re.IGNORECASE)) or
                    (cat == "Tutorium" and re.search(r'tutorium', sf.name, re.IGNORECASE))
                )
                is_sole = (len(same_dir_assignments) <= 1 and sol_sheet == sheet)
                is_cat_sheet = (cat_match and sol_sheet == sheet)

                if is_direct or is_cat_sheet or is_sole:
                    matching_sols.append(sf)

            matching_sol = matching_sols[0] if matching_sols else None
            sol_rel_path = os.path.relpath(matching_sol, WORKSPACE_ROOT).replace('\\', '/') if matching_sol else None
            sol_note = f"{len(matching_sols)} Lösungen vorhanden" if len(matching_sols) > 1 else (f"Lösung vorhanden: {matching_sol.name}" if matching_sol else None)

            file_size = format_file_size(af.stat().st_size)
            file_ext = af.suffix.lstrip('.').upper()

            sol_name = matching_sol.name if matching_sol else None
            sol_size = format_file_size(matching_sol.stat().st_size) if matching_sol else None
            sol_ext = matching_sol.suffix.lstrip('.').upper() if matching_sol else None

            override = user_overrides.get(task_id) or user_overrides_by_path.get(norm_rel_file)
            auto_done = matching_sol is not None
            manual_status = override.get("manual_status") if override else None
            is_completed = manual_status if manual_status is not None else auto_done

            default_opt = (cat in ("Präsenzübung", "Tutorium"))
            is_opt = override.get("is_optional", default_opt) if override and override.get("is_optional") is not None else default_opt

            scanned_tasks.append({
                "id": task_id,
                "subject": subj,
                "category": cat,
                "sheet": sheet,
                "title": display_title,
                "file_path": rel_file,
                "file_name": af.name,
                "file_size": file_size,
                "file_ext": file_ext,
                "is_folder": False,
                "solution_path": sol_rel_path,
                "solution_name": sol_name,
                "solution_size": sol_size,
                "solution_ext": sol_ext,
                "solution_note": sol_note,
                "auto_detected": auto_done,
                "manual_status": manual_status,
                "completed": is_completed,
                "is_optional": is_opt,
                "notes": override.get("notes", "") if override else "",
                "priority": override.get("priority", "normal") if override else "normal",
                "due_date": override.get("due_date") if override else None,
                "is_custom": False,
                "last_modified": datetime.fromtimestamp(af.stat().st_mtime).isoformat()
            })

    all_tasks = sorted(scanned_tasks + custom_tasks, key=lambda t: (t.get("subject", ""), t.get("sheet", ""), t.get("category", ""), t.get("title", "")))
    mandatory_tasks = [t for t in all_tasks if not t.get("is_optional")]
    optional_tasks = [t for t in all_tasks if t.get("is_optional")]

    final_db = {
        "version": "2.4",
        "last_scanned": datetime.now().isoformat(),
        "total_count": len(all_tasks),
        "completed_count": sum(1 for t in all_tasks if t.get("completed")),
        "pending_count": sum(1 for t in all_tasks if not t.get("completed")),
        "mandatory_count": len(mandatory_tasks),
        "mandatory_completed": sum(1 for t in mandatory_tasks if t.get("completed")),
        "optional_count": len(optional_tasks),
        "optional_completed": sum(1 for t in optional_tasks if t.get("completed")),
        "ignored_tasks": existing_db.get("ignored_tasks", []),
        "tasks": all_tasks
    }

    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_db, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving DB: {e}")

    return final_db


def open_in_system_explorer(target_path):
    p = os.path.abspath(target_path)
    if not os.path.exists(p):
        p = os.path.dirname(p)
    sys_name = platform.system()
    if sys_name == 'Windows':
        os.startfile(p)
    elif sys_name == 'Darwin':
        subprocess.Popen(['open', p])
    else:
        subprocess.Popen(['xdg-open', p])


class ModulwerkRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet logs for clean console
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path in ('/', '/index.html'):
            if HTML_FILE.exists():
                content = HTML_FILE.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_cors_headers()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Modulwerk.html not found")
            return

        # Static assets
        m = re.match(r'^(?:/static|/\.tracker/static)/(.*)$', path)
        if m:
            rel_url = unquote(m.group(1).split('?')[0])
            file_path = (STATIC_DIR / rel_url).resolve()
            if str(file_path).startswith(str(STATIC_DIR)) and file_path.is_file():
                content = file_path.read_bytes()
                mime, _ = mimetypes.guess_type(str(file_path))
                if file_path.suffix == '.css':
                    mime = 'text/css; charset=utf-8'
                elif file_path.suffix == '.js':
                    mime = 'application/javascript; charset=utf-8'
                elif not mime:
                    mime = 'application/octet-stream'

                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_cors_headers()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Static file not found")
            return

        # View / stream file
        if path == '/file':
            task_id = qs.get('id', [None])[0]
            is_sol = qs.get('type', [''])[0] == 'solution'
            if not task_id or not DB_FILE.exists():
                self.send_error(404, "Missing file ID or database")
                return

            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)
            task = next((t for t in db.get("tasks", []) if t.get("id") == task_id), None)
            if not task:
                self.send_error(404, "Task not found")
                return

            rel_p = task.get("solution_path" if is_sol else "file_path")
            if not rel_p:
                self.send_error(404, "File path missing")
                return

            abs_p = (WORKSPACE_ROOT / rel_p).resolve()
            if abs_p.is_file():
                content = abs_p.read_bytes()
                mime, _ = mimetypes.guess_type(str(abs_p))
                if not mime:
                    mime = 'application/pdf' if abs_p.suffix.lower() == '.pdf' else 'application/octet-stream'

                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Disposition', f'inline; filename="{abs_p.name}"')
                self.send_cors_headers()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, f"File {abs_p} not found on disk")
            return

        # API: Tasks
        if path == '/api/tasks':
            if not DB_FILE.exists():
                scan_workspace()
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json(data)
            return

        # API: Normalize Preview
        if path == '/api/normalize-preview':
            if not DB_FILE.exists():
                scan_workspace()
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)

            candidates = []
            for t in db.get("tasks", []):
                for is_sol in (False, True):
                    f_name = t.get("solution_name" if is_sol else "file_name")
                    rel_p = t.get("solution_path" if is_sol else "file_path")
                    if not f_name or not rel_p or t.get("is_folder"):
                        continue
                    subj = t.get("subject", "Modul").replace(' ', '_')
                    cat = t.get("category", "Uebung").replace(' ', '_')
                    sheet = t.get("sheet", "Blatt_01").replace(' ', '_')
                    ext = Path(f_name).suffix.lstrip('.')
                    suffix = "_Loesung" if is_sol else ""
                    proposed = f"{subj}_{cat}_{sheet}{suffix}.{ext}"

                    if f_name.lower() != proposed.lower():
                        candidates.append({
                            "taskId": t.get("id"),
                            "isSolution": is_sol,
                            "subject": t.get("subject"),
                            "sheet": t.get("sheet"),
                            "type": "Solution" if is_sol else "Assignment",
                            "currentName": f_name,
                            "proposedName": proposed,
                            "currentRelPath": rel_p
                        })
            self.send_json({"success": True, "candidates": candidates})
            return

        self.send_error(404, "Endpoint not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(raw_body.decode('utf-8'))
        except Exception:
            body = {}

        if path == '/api/scan':
            data = scan_workspace()
            self.send_json({"success": True, "data": data})
            return

        if path == '/api/toggle':
            task_id = body.get('id')
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                for t in db.get("tasks", []):
                    if t.get("id") == task_id:
                        t["completed"] = not t.get("completed", False)
                        t["manual_status"] = t["completed"]
                        break
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=2, ensure_ascii=False)
                self.send_json({"success": True, "data": db})
            else:
                self.send_json({"success": False, "error": "DB not found"}, 404)
            return

        if path == '/api/toggle-optional':
            task_id = body.get('id')
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                for t in db.get("tasks", []):
                    if t.get("id") == task_id:
                        t["is_optional"] = not t.get("is_optional", False)
                        break
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=2, ensure_ascii=False)
                self.send_json({"success": True, "data": db})
            else:
                self.send_json({"success": False, "error": "DB not found"}, 404)
            return

        if path == '/api/note':
            task_id = body.get('id')
            notes = body.get('notes', '')
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                for t in db.get("tasks", []):
                    if t.get("id") == task_id:
                        t["notes"] = notes
                        break
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=2, ensure_ascii=False)
                self.send_json({"success": True})
            else:
                self.send_json({"success": False, "error": "DB not found"}, 404)
            return

        if path == '/api/open-folder':
            rel_p = body.get('path', '')
            abs_p = (WORKSPACE_ROOT / rel_p).resolve() if rel_p else WORKSPACE_ROOT
            open_in_system_explorer(abs_p)
            self.send_json({"success": True})
            return

        if path == '/api/upload':
            fn = body.get('filename')
            b64 = body.get('dataBase64')
            if not fn or not b64:
                self.send_json({"success": False, "error": "Missing file data"}, 400)
                return

            subj = body.get('targetSubject') or "General"
            sheet = body.get('targetSheet') or get_sheet_number(fn)
            is_sol = body.get('isSolution', False)

            # Clean sheet folder name
            sheet_folder = re.sub(r'[^a-zA-Z0-9_-]', '_', sheet)
            dest_dir = WORKSPACE_ROOT / subj / sheet_folder
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_file = dest_dir / fn

            try:
                data_bytes = base64.b64decode(b64)
                with open(dest_file, 'wb') as f:
                    f.write(data_bytes)
                db = scan_workspace()
                self.send_json({"success": True, "message": f"{fn} saved successfully!", "data": db})
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
            return

        if path == '/api/delete-task':
            t_id = body.get('id')
            delete_disk = body.get('deleteFromDisk', False)
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                task = next((t for t in db.get("tasks", []) if t.get("id") == t_id), None)
                if task:
                    db["tasks"] = [t for t in db.get("tasks", []) if t.get("id") != t_id]
                    if "ignored_tasks" not in db:
                        db["ignored_tasks"] = []
                    task["deleted_from_disk"] = delete_disk
                    db["ignored_tasks"].append(task)

                    if delete_disk and task.get("file_path"):
                        fp = (WORKSPACE_ROOT / task["file_path"]).resolve()
                        if fp.exists():
                            if fp.is_dir():
                                shutil.rmtree(fp, ignore_errors=True)
                            else:
                                fp.unlink(missing_ok=True)

                    with open(DB_FILE, 'w', encoding='utf-8') as f:
                        json.dump(db, f, indent=2, ensure_ascii=False)
                    self.send_json({"success": True, "data": db})
                    return
            self.send_json({"success": False, "error": "Task not found"}, 404)
            return

        if path == '/api/restore-task':
            t_id = body.get('id')
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                db["ignored_tasks"] = [it for it in db.get("ignored_tasks", []) if it.get("id") != t_id]
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=2, ensure_ascii=False)
                new_db = scan_workspace()
                self.send_json({"success": True, "data": new_db})
                return
            self.send_json({"success": False, "error": "DB not found"}, 404)
            return

        if path == '/api/add-task':
            t_id = f"custom-{int(datetime.now().timestamp() * 1000)}"
            new_task = {
                "id": t_id,
                "subject": body.get("subject", "General"),
                "category": body.get("category", "Homework"),
                "sheet": body.get("sheet", "Sheet 01"),
                "title": body.get("title", "New Task"),
                "notes": body.get("notes", ""),
                "is_optional": bool(body.get("is_optional", False)),
                "completed": False,
                "is_custom": True,
                "priority": "normal",
                "last_modified": datetime.now().isoformat()
            }
            if DB_FILE.exists():
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                db.setdefault("tasks", []).append(new_task)
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=2, ensure_ascii=False)
            self.send_json({"success": True, "data": new_task})
            return

        if path == '/api/normalize-execute':
            items = body.get('items', [])
            renamed_count = 0
            errors = []
            for item in items:
                curr_rel = item.get("currentRelPath")
                prop_name = item.get("proposedName")
                if curr_rel and prop_name:
                    src = (WORKSPACE_ROOT / curr_rel).resolve()
                    if src.is_file():
                        dest = src.parent / prop_name
                        try:
                            src.rename(dest)
                            renamed_count += 1
                        except Exception as e:
                            errors.append(f"{src.name} -> {e}")
            new_db = scan_workspace()
            self.send_json({
                "success": len(errors) == 0,
                "renamedCount": renamed_count,
                "errors": errors,
                "data": new_db
            })
            return

        self.send_error(404, "Endpoint not found")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_cors_headers()
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_server(port=5050):
    server_address = ('', port)
    for p in range(port, port + 50):
        try:
            httpd = HTTPServer(('', p), ModulwerkRequestHandler)
            actual_port = p
            break
        except OSError:
            continue
    else:
        print("Error: No available port between 5050 and 5100.")
        sys.exit(1)

    url = f"http://localhost:{actual_port}/"
    print("=" * 58)
    print("  Modulwerk Server Active (Cross-Platform Python Engine)")
    print(f"  URL: {url}")
    print(f"  Platform: {platform.system()} ({platform.machine()})")
    print("  Press Ctrl+C to stop.")
    print("=" * 58)

    # Initial scan
    scan_workspace()

    # Open browser automatically
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Modulwerk server...")
        httpd.server_close()


if __name__ == '__main__':
    run_server()
