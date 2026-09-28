"""Configuration and platform save detection module."""

from src.tracker.config.manager import (
    DEFAULT_CONFIG,
    DEFAULT_CONFIG_PATH,
    ConfigManager,
)
from src.tracker.config.detector import (
    detect_gamepass_save_path,
    detect_gog_save_path,
    detect_save_path,
    detect_steam_save_path,
    find_any_save_file,
)

__all__ = [
    "DEFAULT_CONFIG",
    "DEFAULT_CONFIG_PATH",
    "ConfigManager",
    "detect_gamepass_save_path",
    "detect_gog_save_path",
    "detect_save_path",
    "detect_steam_save_path",
    "find_any_save_file",
]
