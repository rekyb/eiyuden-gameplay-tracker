"""Domain models and database loaders for Eiyuden Chronicle Tracker."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


def load_characters(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load character database from characters.json.

    Args:
        data_dir: Optional directory or file path for characters.json. Defaults to project data/.

    Returns:
        List of character dictionaries.
    """
    if data_dir is not None:
        p = Path(data_dir)
        path = p if p.is_file() else p / "characters.json"
    else:
        path = DATA_DIR / "characters.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_recipes(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load recipe database from recipes.json.

    Args:
        data_dir: Optional directory or file path for recipes.json. Defaults to project data/.

    Returns:
        List of recipe dictionaries.
    """
    if data_dir is not None:
        p = Path(data_dir)
        path = p if p.is_file() else p / "recipes.json"
    else:
        path = DATA_DIR / "recipes.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_beigoma(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load beigoma database from beigoma.json.

    Args:
        data_dir: Optional directory or file path for beigoma.json. Defaults to project data/.

    Returns:
        List of beigoma dictionaries.
    """
    if data_dir is not None:
        p = Path(data_dir)
        path = p if p.is_file() else p / "beigoma.json"
    else:
        path = DATA_DIR / "beigoma.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_beigoma_trainers(data_dir: Optional[Union[Path, str]] = None) -> List[Dict[str, Any]]:
    """Load beigoma trainers database from beigoma_trainers.json.

    Args:
        data_dir: Optional directory or file path for beigoma_trainers.json. Defaults to project data/.

    Returns:
        List of beigoma trainer dictionaries.
    """
    if data_dir is not None:
        p = Path(data_dir)
        path = p if p.is_file() else p / "beigoma_trainers.json"
    else:
        path = DATA_DIR / "beigoma_trainers.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

