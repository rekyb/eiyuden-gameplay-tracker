"""Domain models and database loaders for Eiyuden Chronicle Tracker."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


def load_characters(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load character database from characters.json.

    Args:
        data_dir: Optional directory containing characters.json. Defaults to project data/.

    Returns:
        List of character dictionaries.
    """
    base = Path(data_dir) if data_dir is not None else DATA_DIR
    path = base / "characters.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_recipes(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load recipe database from recipes.json.

    Args:
        data_dir: Optional directory containing recipes.json. Defaults to project data/.

    Returns:
        List of recipe dictionaries.
    """
    base = Path(data_dir) if data_dir is not None else DATA_DIR
    path = base / "recipes.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
