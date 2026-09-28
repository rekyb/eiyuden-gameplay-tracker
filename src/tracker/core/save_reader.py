"""Eiyuden Chronicle: Hundred Heroes Save File Reader & Decryption Core.

Provides save file reading, summary extraction, and validation routines
using the core TripleDES-CBC cryptography module.
"""

import json
import os
from typing import Any, Dict, List, Optional

from src.tracker.core.crypto import (
    KEY,
    IV,
    decrypt_save_bytes,
    encrypt_save_dict,
    is_valid_magic,
)

PROTAGONIST_NAMES: Dict[int, str] = {
    10: "Nowa",
    20: "Seign",
    150: "Marisa",
}


def decrypt_save(data: bytes) -> Dict[str, Any]:
    """Decrypt TripleDES-CBC PKCS7-padded save data and parse as JSON dict.

    Args:
        data: Raw encrypted bytes from UserData0.dat.

    Returns:
        Decoded save file dictionary.

    Raises:
        ValueError: If decryption or JSON deserialization fails.
        TypeError: If data is not bytes or bytearray.
    """
    try:
        plaintext = decrypt_save_bytes(data)
        return json.loads(plaintext.decode("utf-8"))
    except (TypeError, ValueError):
        raise
    except Exception as exc:
        raise ValueError(f"Failed to decrypt save data: {exc}") from exc


def encrypt_save(data: Dict[str, Any]) -> bytes:
    """Encrypt Python dictionary into TripleDES-CBC PKCS7-padded save bytes.

    Args:
        data: Save file dictionary to serialize and encrypt.

    Returns:
        Encrypted ciphertext bytes.
    """
    return encrypt_save_dict(data)


def extract_save_data(decrypted_bytes: bytes) -> Dict[str, Any]:
    """Parse decrypted save bytes into a Python dictionary.

    Args:
        decrypted_bytes: Decrypted plaintext bytes.

    Returns:
        Decoded dictionary.

    Raises:
        ValueError: If JSON deserialization fails.
    """
    try:
        return json.loads(decrypted_bytes.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to parse decrypted save data: {exc}") from exc


def read_save_summary(filepath: Optional[str]) -> Dict[str, Any]:
    """Read and extract key game progress indicators from a save file.

    Extracts recruited character IDs, playtime, money, town level,
    population, protagonist, and timestamp without modifying the source file.
    Safely handles edge cases like missing paths, deleted files, unreadable files,
    or corrupted data without raising unhandled exceptions.

    Args:
        filepath: Path to the save file.

    Returns:
        Dictionary with save summary fields, including `file_exists` status.
    """
    empty_summary = {
        "file_exists": False,
        "recruited_ids": [],
        "acquired_recipe_ids": [],
        "acquired_recipe_count": 0,
        "beigoma_collected_ids": [],
        "beigoma_collected_count": 0,
        "beigoma_defeated_trainer_ids": [],
        "beigoma_defeated_trainer_count": 0,
        "playtime_seconds": 0.0,
        "playtime_formatted": "0h 0m 0s",
        "money": 0,
        "town_level": 0,
        "population": 0,
        "protagonist_id": 0,
        "protagonist": "",
        "save_timestamp": None,
    }

    if not filepath or not isinstance(filepath, (str, os.PathLike)):
        return {**empty_summary, "error": "No save file path provided."}

    try:
        if not os.path.isfile(filepath):
            return {**empty_summary, "error": f"Save file not found at: {filepath}"}
    except Exception as exc:
        return {**empty_summary, "error": f"Invalid path: {exc}"}

    try:
        with open(filepath, "rb") as f:
            ciphertext = f.read()
    except OSError as exc:
        return {
            **empty_summary,
            "file_exists": True,
            "error": f"Failed to read save file: {exc}",
        }

    try:
        save_data = decrypt_save(ciphertext)
    except Exception as exc:
        return {
            **empty_summary,
            "file_exists": True,
            "corrupted": True,
            "error": f"Failed to decrypt or parse save file: {exc}",
        }

    # Recruited character IDs
    raw_units = save_data.get("_unitData", {}).get("_units", [])
    recruited_ids: List[int] = []
    for u in raw_units:
        if isinstance(u, dict):
            uid = u.get("_id")
            if isinstance(uid, int):
                recruited_ids.append(uid)

    if not recruited_ids and "UserData" in save_data:
        raw_units = save_data.get("UserData", {}).get("UnitData", [])
        if isinstance(raw_units, list):
            for u in raw_units:
                if isinstance(u, dict):
                    uid = u.get("UnitId") or u.get("_id") or u.get("id")
                    if isinstance(uid, int):
                        recruited_ids.append(uid)

    # Recipe & Restaurant Dishes extraction
    acquired_recipe_ids_set = set()

    # 1. From Restaurant CookableList
    rest_data = save_data.get("_fortressTownRestaurantData", {})
    cookable_list = rest_data.get("<CookableList>k__BackingField", [])
    if isinstance(cookable_list, list):
        for item in cookable_list:
            if isinstance(item, dict):
                cuisine_id = item.get("<Cuisine>k__BackingField")
                if isinstance(cuisine_id, int) and 3000 <= cuisine_id <= 3092:
                    acquired_recipe_ids_set.add(cuisine_id)

    # 2. From Item Obtain Counters (recipe items in 8000s)
    item_data = save_data.get("_itemObtainData", {})
    counters = item_data.get("_counters", [])
    if isinstance(counters, list):
        for c in counters:
            if isinstance(c, dict):
                item_id = c.get("_key")
                count = c.get("_value", 0)
                if isinstance(item_id, int) and 8000 <= item_id <= 8201 and count > 0:
                    # Convert item 80XX to dish 30XX
                    dish_id = 3000 + (item_id % 1000)
                    if 3000 <= dish_id <= 3092:
                        acquired_recipe_ids_set.add(dish_id)

    # 3. Fallback from UserData container
    user_data = save_data.get("UserData", {})
    if isinstance(user_data, dict):
        menu_list = user_data.get("Restaurant", {}).get("MenuList", [])
        if isinstance(menu_list, list):
            for m in menu_list:
                if isinstance(m, int) and 3000 <= m <= 3092:
                    acquired_recipe_ids_set.add(m)
        inv = user_data.get("Inventory", [])
        if isinstance(inv, list):
            for item in inv:
                if isinstance(item, dict):
                    iid = item.get("ItemId")
                    cnt = item.get("Count", 0)
                    if isinstance(iid, int) and 8000 <= iid <= 8201 and cnt > 0:
                        dish_id = 3000 + (iid % 1000)
                        if 3000 <= dish_id <= 3092:
                            acquired_recipe_ids_set.add(dish_id)

    acquired_recipe_ids = sorted(list(acquired_recipe_ids_set))

    # Beigoma & Trainer extraction
    beigoma_data = save_data.get("_miniGameBeigoma")
    if not isinstance(beigoma_data, dict):
        user_data_candidate = save_data.get("UserData")
        if isinstance(user_data_candidate, dict):
            beigoma_data = user_data_candidate.get("MiniGameBeigoma", {})
        else:
            beigoma_data = {}
    if not isinstance(beigoma_data, dict):
        beigoma_data = {}

    raw_usable = beigoma_data.get("_usableBeigomaIDs", [])
    # Only keep valid collectible IDs (exclude enemy-only tops 604, 605, 606)
    excluded_tops = {604, 605, 606}
    if isinstance(raw_usable, list):
        beigoma_collected_ids = sorted(
            list({bid for bid in raw_usable if isinstance(bid, int) and bid not in excluded_tops})
        )
    else:
        beigoma_collected_ids = []

    raw_matches = beigoma_data.get("_matchResult", [])
    defeated_trainer_ids = set()
    if isinstance(raw_matches, list):
        for match in raw_matches:
            if isinstance(match, dict):
                c_id = match.get("_characterParamId")
                win_cnt = match.get("_winCount", 0)
                if isinstance(c_id, int) and c_id != 1 and win_cnt > 0:
                    defeated_trainer_ids.add(c_id)

    beigoma_defeated_trainer_ids = sorted(list(defeated_trainer_ids))

    # Playtime
    raw_seconds = save_data.get("_seconds")
    if raw_seconds is None and isinstance(user_data, dict):
        raw_seconds = user_data.get("PlayTime", 0.0)
    try:
        seconds = float(raw_seconds or 0.0)
    except (ValueError, TypeError):
        seconds = 0.0

    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    playtime_formatted = f"{h}h {m}m {s}s"

    # Headquarters / Fortress Town stats
    ft = save_data.get("_fortressTown", {})
    town_level_val = ft.get("_fortressTownLevel")
    if town_level_val is None and isinstance(user_data, dict):
        town_level_val = user_data.get("TownLevel", 0)
    try:
        town_level = int(town_level_val or 0)
    except (ValueError, TypeError):
        town_level = 0

    pop_val = ft.get("_population")
    if pop_val is None and isinstance(user_data, dict):
        pop_val = user_data.get("Population", 0)
    try:
        population = int(pop_val or 0)
    except (ValueError, TypeError):
        population = 0

    # Money / Baqua
    money_val = save_data.get("_money")
    if money_val is None and isinstance(user_data, dict):
        money_val = user_data.get("Money", 0)
    try:
        money = int(money_val or 0)
    except (ValueError, TypeError):
        money = 0

    # Protagonist
    protagonist_id_val = save_data.get("_personalUnitId")
    if protagonist_id_val is None and isinstance(user_data, dict):
        protagonist_id_val = user_data.get("Protagonist", 0)
    try:
        protagonist_id = int(protagonist_id_val or 0)
    except (ValueError, TypeError):
        protagonist_id = 0

    protagonist_name = PROTAGONIST_NAMES.get(
        protagonist_id, f"Hero_{protagonist_id}" if protagonist_id else ""
    )

    # Timestamp
    save_timestamp = save_data.get("_datetime")

    return {
        "file_exists": True,
        "recruited_ids": recruited_ids,
        "acquired_recipe_ids": acquired_recipe_ids,
        "acquired_recipe_count": len(acquired_recipe_ids),
        "beigoma_collected_ids": beigoma_collected_ids,
        "beigoma_collected_count": len(beigoma_collected_ids),
        "beigoma_defeated_trainer_ids": beigoma_defeated_trainer_ids,
        "beigoma_defeated_trainer_count": len(beigoma_defeated_trainer_ids),
        "playtime_seconds": seconds,
        "playtime_formatted": playtime_formatted,
        "money": money,
        "town_level": town_level,
        "population": population,
        "protagonist_id": protagonist_id,
        "protagonist": protagonist_name,
        "save_timestamp": save_timestamp,
    }


def validate_save_file(save_path: Optional[str]) -> bool:
    """Validate whether the given path points to a valid Eiyuden Chronicle save file.

    Args:
        save_path: Path to the save file.

    Returns:
        bool: True if file exists and contains valid decryptable save data, False otherwise.
    """
    if not save_path or not isinstance(save_path, (str, os.PathLike)):
        return False

    clean_path = str(save_path).strip()
    if not clean_path:
        return False

    try:
        if not os.path.isfile(clean_path):
            return False
        with open(clean_path, "rb") as f:
            ciphertext = f.read()
        if len(ciphertext) == 0:
            return False
        plaintext = decrypt_save_bytes(ciphertext)
        if not is_valid_magic(plaintext):
            return False
        save_data = json.loads(plaintext.decode("utf-8"))
        if not isinstance(save_data, dict):
            return False
        return "_unitData" in save_data or "UserData" in save_data
    except Exception:
        return False
