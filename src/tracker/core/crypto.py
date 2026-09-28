"""Core cryptographic routines for Eiyuden Chronicle save files.

Provides TripleDES-CBC decryption/encryption with PKCS7 padding and magic validation.
"""

import json
from typing import Dict, Any

from cryptography.hazmat.primitives.ciphers import Cipher, modes
from cryptography.hazmat.primitives import padding

try:
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
except ImportError:  # pragma: no cover - fallback for older cryptography versions
    from cryptography.hazmat.primitives.ciphers.algorithms import TripleDES

KEY: bytes = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
IV: bytes = bytes.fromhex("2f6e9693c9779505")


def decrypt_save_bytes(data: bytes) -> bytes:
    """Decrypt TripleDES-CBC PKCS7-padded save bytes to raw plaintext bytes.

    Args:
        data: Encrypted save file bytes.

    Returns:
        Decrypted plaintext bytes.

    Raises:
        ValueError: If data length is not a multiple of 8 or padding/decryption fails.
        TypeError: If data is not bytes or bytearray.
    """
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("Encrypted data must be bytes or bytearray")
    if len(data) % 8 != 0:
        raise ValueError("Encrypted data length must be a multiple of 8 bytes")

    try:
        cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
        decryptor = cipher.decryptor()
        padded = decryptor.update(data) + decryptor.finalize()
        unpadder = padding.PKCS7(64).unpadder()
        return unpadder.update(padded) + unpadder.finalize()
    except Exception as exc:
        raise ValueError(f"Failed to decrypt save data: {exc}") from exc


def encrypt_save_dict(data: Dict[str, Any]) -> bytes:
    """Serialize dictionary to JSON and encrypt into TripleDES-CBC PKCS7-padded bytes.

    Args:
        data: Dictionary to encrypt.

    Returns:
        Encrypted ciphertext bytes.
    """
    raw_json = json.dumps(data).encode("utf-8")
    padder = padding.PKCS7(64).padder()
    padded = padder.update(raw_json) + padder.finalize()
    cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
    encryptor = cipher.encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def is_valid_magic(data: bytes) -> bool:
    """Verify whether decrypted save bytes contain valid magic or JSON format.

    Args:
        data: Decrypted plaintext bytes.

    Returns:
        True if data matches expected save data signatures, False otherwise.
    """
    try:
        if not isinstance(data, (bytes, bytearray)):
            return False
        head = data[:300].decode("utf-8", errors="replace").strip()
        if not head:
            return False
        return (
            "UserData" in head
            or "_unitData" in head
            or ('"id"' in head and '"name"' in head)
            or head.startswith("{")
        )
    except Exception:
        return False
