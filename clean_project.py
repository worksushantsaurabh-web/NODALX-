#!/usr/bin/env python3
import os
import shutil
from pathlib import Path

JUNK_DIRS = {
    '__pycache__', '.pytest_cache', '.mypy_cache', '.tox', '.eggs',
    'build', 'dist', '*.egg-info', '.coverage', 'htmlcov',
    '.next', 'out', 'coverage', '.nyc_output',
    '.gradle', 'target', '.idea',
}

JUNK_FILES = {
    '.DS_Store', 'Thumbs.db', '*.pyc', '*.pyo', '*.log',
    '*.tmp', '*.temp', '*.swp', '*.swo', '*~',
    '.coverage', 'coverage.xml', '*.cover',
    'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*',
}

PROTECTED = {'.git', 'node_modules', 'venv', '.venv', 'env', 'vendor'}

def get_size(path):
    try:
        if os.path.isfile(path):
            size = os.path.getsize(path)
        else:
            size = sum(f.stat().st_size for f in Path(path).rglob('*') if f.is_file())
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    except:
        return "?"

def find_junk(root):
    junk = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in PROTECTED]
        for d in dirnames:
            if d in JUNK_DIRS or any(d.endswith(ext.replace('*', '')) for ext in JUNK_DIRS if '*' in ext):
                full = os.path.join(dirpath, d)
                junk.append(('DIR', full, get_size(full)))
        for f in filenames:
            if f in JUNK_FILES or any(f.endswith(ext.replace('*', '')) for ext in JUNK_FILES if '*' in ext):
                full = os.path.join(dirpath, f)
                junk.append(('FILE', full, get_size(full)))
    return junk

if __name__ == '__main__':
    root = os.getcwd()
    print(f"Scanning: {root}\n")
    junk = find_junk(root)
    if not junk:
        print("No clutter found!")
        exit()
    total_dirs = sum(1 for t, _, _ in junk if t == 'DIR')
    total_files = sum(1 for t, _, _ in junk if t == 'FILE')
    print(f"Found {total_dirs} junk folders and {total_files} junk files:\n")
    for typ, path, size in junk:
        print(f"{typ:<6} {size:<10} {os.path.relpath(path, root)}")
    print(f"\n{len(junk)} items will be PERMANENTLY DELETED.")
    confirm = input("\nType 'DELETE' to proceed: ")
    if confirm.strip() == 'DELETE':
        for typ, path, _ in junk:
            try:
                if typ == 'DIR':
                    shutil.rmtree(path)
                else:
                    os.remove(path)
            except Exception as e:
                print(f"Failed: {path}: {e}")
        print(f"\nCleaned! Removed {len(junk)} items.")
    else:
        print("\nCancelled.")
