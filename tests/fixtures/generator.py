"""Synthetic save fixture generator for unit and integration testing.

Generates valid TripleDES-CBC encrypted save payloads without requiring committed game saves.
"""

from typing import List, Optional, Any
from src.tracker.core.crypto import encrypt_save_dict


def create_synthetic_save(
    hero_ids: Optional[List[int]] = None,
    recipe_item_ids: Optional[List[int]] = None,
    playtime: float = 12345.0,
    money: int = 50000,
    town_level: int = 2,
    population: int = 45,
    **kwargs: Any,
) -> bytes:
    """Create an encrypted synthetic save file payload for testing.

    Args:
        hero_ids: List of integer character IDs recruited. Defaults to [1, 2, 3, 4, 5].
        recipe_item_ids: List of recipe item IDs in inventory (e.g. 8001..8003).
        playtime: Total playtime in seconds.
        money: Total Baqua / money.
        town_level: Fortress town level.
        population: Fortress town population.
        **kwargs: Optional additional payload overrides.

    Returns:
        Encrypted save payload bytes.
    """
    if hero_ids is None:
        hero_ids = [1, 2, 3, 4, 5]
    if recipe_item_ids is None:
        recipe_item_ids = [8001, 8002, 8003]

    unit_data_list = [{"UnitId": uid, "Level": 20, "Exp": 1000} for uid in hero_ids]
    inventory_items = [{"ItemId": iid, "Count": 1} for iid in recipe_item_ids]

    user_data = {
        "PlayTime": playtime,
        "Money": money,
        "TownLevel": town_level,
        "Population": population,
        "Protagonist": kwargs.get("protagonist", 1),
        "UnitData": unit_data_list,
        "Inventory": inventory_items,
        "Restaurant": {
            "MenuList": [3000, 3001]
        },
    }
    if "UserData" in kwargs and isinstance(kwargs["UserData"], dict):
        user_data.update(kwargs["UserData"])

    payload = {
        "UserData": user_data,
        "_unitData": {"_units": [{"_id": uid} for uid in hero_ids]},
        "_seconds": playtime,
        "_money": money,
        "_fortressTown": {
            "_fortressTownLevel": town_level,
            "_population": population,
        },
        "_personalUnitId": kwargs.get("protagonist_id", kwargs.get("protagonist", 1)),
        "_datetime": kwargs.get("save_timestamp", -8584111660674826987),
        "_itemObtainData": {
            "_counters": [{"_key": iid, "_value": 1} for iid in recipe_item_ids]
        },
        "_fortressTownRestaurantData": {
            "<CookableList>k__BackingField": [
                {"<Cuisine>k__BackingField": 3000},
                {"<Cuisine>k__BackingField": 3001},
            ]
        },
    }

    for k, v in kwargs.items():
        if k not in ("UserData", "protagonist", "protagonist_id", "save_timestamp"):
            payload[k] = v

    return encrypt_save_dict(payload)
