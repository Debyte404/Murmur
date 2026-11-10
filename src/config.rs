// src/config.rs
use std::fs;
use std::path::PathBuf;

pub struct Creds {
    pub username: String,
    pub token: String,
}

// Windows: C:\Users\you\AppData\Roaming\murmur\creds
// Linux/macOS: ~/.config/murmur/creds
pub fn creds_path() -> Option<PathBuf> {
    dirs::config_dir().map(|dir| dir.join("murmur").join("creds"))
}

pub fn load() -> Option<Creds> {
    let path = creds_path()?;
    let content = fs::read_to_string(path).ok()?;
    let mut lines = content.lines();
    let username = lines.next()?.to_string();
    let token = lines.next()?.to_string();
    Some(Creds { username, token })
}

pub fn save(creds: &Creds) -> std::io::Result<()> {
    let path = creds_path().ok_or_else(|| std::io::Error::other("no config folder"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{}\n{}\n", creds.username, creds.token))?;
    Ok(())
}

pub fn logout() -> std::io::Result<()> {
    let path = creds_path().ok_or_else(|| std::io::Error::other("no config folder"))?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}
