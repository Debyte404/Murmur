use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ApiResponse {
    pub origin: Option<String>,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct PostData {
    pub title: String,
    pub body: String,
    pub user_id: u32,
}

pub async fn send_get_request(url: &str) -> Result<String, reqwest::Error> {
    let body = reqwest::get(url).await?.text().await?;
    Ok(body)
}

pub async fn check_unique(url: &str, username: &str) -> Result<bool, reqwest::Error> {
    let endpoint = format!("{url}/api/check?username={username}");
    let text = reqwest::get(&endpoint).await?.text().await?;
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
        return Ok(json.get("available").and_then(|v| v.as_bool()).unwrap_or(false));
    }
    Ok(false)
}
