"""Configuration manager for Eiyuden Chronicle Tracker."""

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "config.json"
DEFAULT_CONFIG: Dict[str, Any] = {
    "save_path": "",
    "cooked_recipe_ids": [],
}


class ConfigManager:
    """Manages application configuration with atomic disk persistence."""

    def __init__(self, config_path: Optional[Union[Path, str]] = None) -> None:
        """Initialize ConfigManager.

        Args:
            config_path: Optional path to config JSON file. Defaults to config/config.json
                relative to project root.
        """
        if config_path is not None:
            self.config_path = Path(config_path).resolve()
        else:
            self.config_path = DEFAULT_CONFIG_PATH.resolve()

    def get_config(self) -> Dict[str, Any]:
        """Read and return current configuration dictionary.

        Returns:
            Dictionary containing 'save_path' and 'cooked_recipe_ids'.
        """
        if not self.config_path.is_file():
            return {
                "save_path": str(DEFAULT_CONFIG.get("save_path", "")),
                "cooked_recipe_ids": list(DEFAULT_CONFIG.get("cooked_recipe_ids", [])),
            }

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                config = dict(DEFAULT_CONFIG)
                config.update(data)
                cooked = config.get("cooked_recipe_ids", [])
                if not isinstance(cooked, list):
                    cooked = []
                return {
                    **config,
                    "save_path": str(config.get("save_path", "")),
                    "cooked_recipe_ids": list(cooked),
                }
        except Exception:
            pass

        return {
            "save_path": str(DEFAULT_CONFIG.get("save_path", "")),
            "cooked_recipe_ids": list(DEFAULT_CONFIG.get("cooked_recipe_ids", [])),
        }

    def save_config(self, config_data: Dict[str, Any]) -> None:
        """Atomically persist configuration dictionary to disk.

        Args:
            config_data: Configuration dictionary to save.
        """
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

        temp_file = tempfile.NamedTemporaryFile(
            mode="w",
            dir=self.config_path.parent,
            delete=False,
            encoding="utf-8",
        )
        temp_path = Path(temp_file.name)
        try:
            try:
                json.dump(config_data, temp_file, indent=2)
                temp_file.flush()
            finally:
                temp_file.close()
            os.replace(temp_path, self.config_path)
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise

    def update_save_path(self, new_path: str) -> None:
        """Update save_path atomically.

        Args:
            new_path: New save file path.
        """
        cfg = self.get_config()
        cfg["save_path"] = str(new_path)
        self.save_config(cfg)

    def get_cooked_recipe_ids(self) -> List[int]:
        """Get list of cooked recipe IDs from configuration.

        Returns:
            List of cooked recipe IDs as integers.
        """
        cfg = self.get_config()
        raw_ids = cfg.get("cooked_recipe_ids", [])
        result = []
        for item in raw_ids:
            try:
                result.append(int(item))
            except (ValueError, TypeError):
                continue
        return result

    def set_cooked_recipe_ids(self, ids: List[int]) -> None:
        """Set list of cooked recipe IDs atomically.

        Args:
            ids: List of recipe IDs that have been cooked.
        """
        cfg = self.get_config()
        cfg["cooked_recipe_ids"] = [int(i) for i in ids]
        self.save_config(cfg)
