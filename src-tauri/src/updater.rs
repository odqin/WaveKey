use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub release_url: String,
    pub body: String,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
}

const GITHUB_REPO: &str = "odqin/WaveKey"; // NOTE: USER MUST UPDATE THIS BEFORE PUSHING
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Checks the GitHub Releases API for a tag that is newer than the current app version.
/// This is a simple semver comparison. It does NOT download the binary.
#[tauri::command]
pub fn check_for_update() -> Option<UpdateInfo> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO);
    
    let client = reqwest::blocking::Client::builder()
        .user_agent(format!("WaveKey-App/{}", CURRENT_VERSION))
        .build()
        .ok()?;

    let response = client.get(&url).send().ok()?;
    
    if !response.status().is_success() {
        return None;
    }

    let release: GithubRelease = response.json().ok()?;
    
    // Strip "v" prefix if present from GitHub tag, e.g. "v0.2.0" -> "0.2.0"
    let latest_version = release.tag_name.trim_start_matches('v');
    
    // Simple naive version comparison string vs string. 
    // Works fine for standard 0.x.y tags.
    if latest_version != CURRENT_VERSION {
        // Technically this triggers if latest != current (so older triggers it too), 
        // but GitHub 'latest' is always the newest published release.
        return Some(UpdateInfo {
            version: release.tag_name.clone(),
            release_url: release.html_url,
            body: release.body.unwrap_or_default(),
        });
    }

    None
}
