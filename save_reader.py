"""Eiyuden Chronicle: Hundred Heroes Save File Reader & Decryption Core.

Decrypts TripleDES-CBC encrypted save files (UserData0.dat), parses summary
information (recruited characters, playtime, money, town stats), and handles
timestamped backups.
"""

import os
import json
import shutil
import datetime
from typing import Dict, Any, List

try:
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
except ImportError:  # pragma: no cover - fallback for older cryptography versions
    from cryptography.hazmat.primitives.ciphers.algorithms import TripleDES

from cryptography.hazmat.primitives.ciphers import Cipher, modes
from cryptography.hazmat.primitives import padding

KEY = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
IV = bytes.fromhex("2f6e9693c9779505")

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
    """
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("Encrypted data must be bytes or bytearray")

    try:
        cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(data) + decryptor.finalize()

        unpadder = padding.PKCS7(64).unpadder()
        plaintext = unpadder.update(padded_data) + unpadder.finalize()

        return json.loads(plaintext.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to decrypt save data: {exc}") from exc


def encrypt_save(data: Dict[str, Any]) -> bytes:
    """Encrypt Python dictionary into TripleDES-CBC PKCS7-padded save bytes.

    Args:
        data: Save file dictionary to serialize and encrypt.

    Returns:
        Encrypted ciphertext bytes.
    """
    plaintext = json.dumps(data).encode("utf-8")
    padder = padding.PKCS7(64).padder()
    padded_data = padder.update(plaintext) + padder.finalize()

    cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
    encryptor = cipher.encryptor()
    return encryptor.update(padded_data) + encryptor.finalize()


def read_save_summary(filepath: str) -> Dict[str, Any]:
    """Read and extract key game progress indicators from a save file.

    Extracts recruited character IDs, playtime, money, town level,
    population, protagonist, and timestamp without modifying the source file.

    Args:
        filepath: Path to the save file.

    Returns:
        Dictionary with save summary fields, including `file_exists` status.
    """
    if not os.path.isfile(filepath):
        return {
            "file_exists": False,
            "recruited_ids": [],
            "playtime_seconds": 0.0,
            "playtime_formatted": "0h 0m 0s",
            "money": 0,
            "town_level": 0,
            "population": 0,
            "protagonist_id": 0,
            "protagonist": "",
            "save_timestamp": None,
        }

    with open(filepath, "rb") as f:
        ciphertext = f.read()

    save_data = decrypt_save(ciphertext)

    # Recruited character IDs
    raw_units = save_data.get("_unitData", {}).get("_units", [])
    recruited_ids: List[int] = []
    for u in raw_units:
        uid = u.get("_id")
        if isinstance(uid, int):
            recruited_ids.append(uid)

    # Playtime
    seconds = float(save_data.get("_seconds", 0.0))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    playtime_formatted = f"{h}h {m}m {s}s"

    # Headquarters / Fortress Town stats
    ft = save_data.get("_fortressTown", {})
    town_level = int(ft.get("_fortressTownLevel", 0))
    population = int(ft.get("_population", 0))

    # Money / Baqua
    money = int(save_data.get("_money", 0))

    # Protagonist
    protagonist_id = int(save_data.get("_personalUnitId", 0))
    protagonist_name = PROTAGONIST_NAMES.get(
        protagonist_id, f"Hero_{protagonist_id}" if protagonist_id else ""
    )

    # Timestamp
    save_timestamp = save_data.get("_datetime")

    return {
        "file_exists": True,
        "recruited_ids": recruited_ids,
        "playtime_seconds": seconds,
        "playtime_formatted": playtime_formatted,
        "money": money,
        "town_level": town_level,
        "population": population,
        "protagonist_id": protagonist_id,
        "protagonist": protagonist_name,
        "save_timestamp": save_timestamp,
    }


def backup_save(filepath: str, backup_dir: str = "backups") -> str:
    """Create a timestamped, byte-exact copy of the save file.

    Args:
        filepath: Path to the existing save file.
        backup_dir: Directory where the backup will be stored (defaults to 'backups').

    Returns:
        Destination path of the created backup file.

    Raises:
        FileNotFoundError: If the source save file does not exist.
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Source save file not found: {filepath}")

    os.makedirs(backup_dir, exist_ok=True)

    base, ext = os.path.splitext(os.path.basename(filepath))
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_name = f"{base}_backup_{timestamp}{ext}"
    dest_path = os.path.join(backup_dir, dest_name)

    counter = 1
    while os.path.exists(dest_path):
        dest_name = f"{base}_backup_{timestamp}_{counter}{ext}"
        dest_path = os.path.join(backup_dir, dest_name)
        counter += 1

    shutil.copy2(filepath, dest_path)
    return dest_path
