import datetime
import os
import sys

sys.path.insert(0, os.path.abspath("../src"))

project = "FirstTry"
author = "arnab19111987-ops"
year = datetime.datetime.now().year
copyright = f"{year}, {author}"
release = "0.1.9"

# Enable Markdown parsing
extensions: list[str] = ["myst_parser"]
templates_path = ["_templates"]
exclude_patterns = ["_build"]

# MyST configuration - safe and minimal (disable linkify since it requires linkify-it-py)
myst_enable_extensions = []
myst_url_schemes = {
    "http": None,
    "https": None,
}

# Source file suffixes
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

html_theme = "alabaster"
html_static_path = ["_static"]
