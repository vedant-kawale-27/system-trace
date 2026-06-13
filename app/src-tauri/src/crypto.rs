//! Data-at-rest encryption for the local database.
//!
//! The live database is held **in memory**; only encrypted snapshots are ever
//! written to disk (periodically and on exit). So no plaintext database file
//! exists at rest - the on-disk file is XChaCha20-Poly1305 ciphertext. The key
//! is a random 32 bytes kept in the OS credential store (Windows Credential
//! Manager / macOS Keychain / Linux Secret Service) via `keyring`, with a
//! restricted key-file fallback when no keyring is available (e.g. a headless
//! box) so the app still works.
//!
//! Pure-Rust crypto (no OpenSSL / C build tools), so it builds on every target
//! with just `cargo`.

use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use rand::RngCore;
use std::path::Path;

const KEYRING_SERVICE: &str = "com.systemtrace.app";
const KEYRING_USER: &str = "db-encryption-key";
const NONCE_LEN: usize = 24;

/// Load the database key from the OS keyring, generating and storing a fresh one
/// on first run. Falls back to a user-only key file beside the data when the
/// keyring is unavailable.
pub fn get_or_create_key(fallback_path: &Path) -> [u8; 32] {
    if let Some(k) = keyring_get() {
        return k;
    }
    if let Ok(bytes) = std::fs::read(fallback_path) {
        if bytes.len() == 32 {
            let mut k = [0u8; 32];
            k.copy_from_slice(&bytes);
            return k;
        }
    }
    let mut key = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key);
    if !keyring_set(&key) {
        let _ = write_key_file(fallback_path, &key);
    }
    key
}

fn keyring_get() -> Option<[u8; 32]> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).ok()?;
    let hex = entry.get_password().ok()?;
    let bytes = from_hex(&hex)?;
    if bytes.len() == 32 {
        let mut k = [0u8; 32];
        k.copy_from_slice(&bytes);
        Some(k)
    } else {
        None
    }
}

fn keyring_set(key: &[u8; 32]) -> bool {
    match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => entry.set_password(&to_hex(key)).is_ok(),
        Err(_) => false,
    }
}

fn write_key_file(path: &Path, key: &[u8; 32]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(path, key)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Encrypt a plaintext blob; output is `nonce || ciphertext`.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key));
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let ct = cipher
        .encrypt(XNonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|_| "encryption failed".to_string())?;
    let mut out = Vec::with_capacity(NONCE_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Decrypt a `nonce || ciphertext` blob produced by [`encrypt`].
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < NONCE_LEN {
        return Err("encrypted database is too short / corrupt".into());
    }
    let (nonce_bytes, ct) = data.split_at(NONCE_LEN);
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key));
    cipher
        .decrypt(XNonce::from_slice(nonce_bytes), ct)
        .map_err(|_| "could not decrypt database (wrong key or corrupt file)".to_string())
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn from_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_encrypts_and_decrypts() {
        let key = [7u8; 32];
        let msg = b"SQLite format 3\0some database bytes";
        let ct = encrypt(&key, msg).unwrap();
        assert_ne!(&ct[24..], &msg[..]); // actually encrypted
        let pt = decrypt(&key, &ct).unwrap();
        assert_eq!(pt, msg);
    }

    #[test]
    fn wrong_key_fails() {
        let ct = encrypt(&[1u8; 32], b"secret").unwrap();
        assert!(decrypt(&[2u8; 32], &ct).is_err());
    }

    #[test]
    fn hex_round_trips() {
        let b = [0u8, 15, 16, 255, 42];
        assert_eq!(from_hex(&to_hex(&b)).unwrap(), b);
    }
}
