"""Platform save file detector for Eiyuden Chronicle: Hundred Heroes."""

import glob
import os
from typing import List, Optional


def _safe_mtime(file_path: str) -> float:
    """Safely obtain file modification timestamp, returning 0.0 on error."""
    try:
        return os.path.getmtime(file_path)
    except OSError:
        return 0.0


def _find_newest_matching_file(patterns: List[str]) -> Optional[str]:
    """Scan patterns and return the path of the newest valid UserData*.dat file.

    Args:
        patterns: Glob pattern strings to search.

    Returns:
        Absolute path to the newest save file, or None if no files found.
    """
    found_files: List[str] = []
    for pat in patterns:
        try:
            matches = glob.glob(pat, recursive=True)
        except (OSError, Exception):
            continue

        for match in matches:
            try:
                if os.path.isfile(match):
                    base_lower = os.path.basename(match).lower()
                    if base_lower in ("userdatainfo.dat", "systemdata.dat"):
                        continue
                    found_files.append(os.path.abspath(match))
            except (OSError, Exception):
                continue

    if not found_files:
        return None

    return max(found_files, key=_safe_mtime)


def detect_steam_save_path() -> Optional[str]:
    """Auto-detect Steam save file path.

    Steam saves are stored under:
    %LOCALAPPDATA%\\..\\LocalLow\\505 Games S_p_A\\EiyudenChronicle\\<SteamID>\\SaveData\\UserData*.dat
    or Proton compatibility data on Linux.

    Returns:
        Absolute path to newest Steam save file, or None.
    """
    patterns: List[str] = []

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        locallow = os.path.join(os.path.dirname(local_app_data), "LocalLow")
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "UserData*.dat",
            )
        )

    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "UserData*.dat",
            )
        )

    # Linux Proton / Steam Deck paths
    home = os.environ.get("HOME") or os.path.expanduser("~")
    if home:
        patterns.append(
            os.path.join(
                home,
                ".steam",
                "steam",
                "steamapps",
                "compatdata",
                "1658280",
                "pfx",
                "drive_c",
                "users",
                "steamuser",
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                home,
                ".local",
                "share",
                "Steam",
                "steamapps",
                "compatdata",
                "1658280",
                "pfx",
                "drive_c",
                "users",
                "steamuser",
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )

    return _find_newest_matching_file(patterns)


def detect_gog_save_path() -> Optional[str]:
    """Auto-detect GOG / DRM-free save file path.

    GOG saves are stored without Steam user IDs in:
    %LOCALAPPDATA%\\..\\LocalLow\\505 Games S_p_A\\EiyudenChronicle\\SaveData\\UserData*.dat
    or %USERPROFILE%\\Saved Games\\EiyudenChronicle\\**\\UserData*.dat.

    Returns:
        Absolute path to newest GOG save file, or None.
    """
    patterns: List[str] = []

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        locallow = os.path.join(os.path.dirname(local_app_data), "LocalLow")
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "UserData*.dat",
            )
        )

    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                user_profile,
                "Saved Games",
                "EiyudenChronicle",
                "**",
                "UserData*.dat",
            )
        )

    home = os.environ.get("HOME") or os.path.expanduser("~")
    if home:
        patterns.append(
            os.path.join(
                home,
                "Games",
                "*",
                "drive_c",
                "users",
                "*",
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "**",
                "UserData*.dat",
            )
        )

    return _find_newest_matching_file(patterns)


def detect_gamepass_save_path() -> Optional[str]:
    """Auto-detect PC Game Pass / Xbox App save file path.

    Game Pass saves are located in Windows Packages directory:
    %LOCALAPPDATA%\\Packages\\*EiyudenChronicle*\\**\\UserData*.dat

    Returns:
        Absolute path to newest Game Pass save file, or None.
    """
    patterns: List[str] = []

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        patterns.append(
            os.path.join(
                local_app_data,
                "Packages",
                "*EiyudenChronicle*",
                "**",
                "UserData*.dat",
            )
        )

    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "Local",
                "Packages",
                "*EiyudenChronicle*",
                "**",
                "UserData*.dat",
            )
        )

    return _find_newest_matching_file(patterns)


def find_any_save_file() -> Optional[str]:
    """Find any available save file across Steam, GOG, and Game Pass in priority order.

    Returns:
        Absolute path to first found save file, or None.
    """
    return (
        detect_steam_save_path()
        or detect_gog_save_path()
        or detect_gamepass_save_path()
        or None
    )


# Alias for backward compatibility
detect_save_path = find_any_save_file
