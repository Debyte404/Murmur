use rustp2p_quic::{Endpoint, PeerId};

pub async fn send_message(endpoint: &Endpoint, peer: PeerId, text: &str) -> rustp2p_quic::Result<()> {
    let (mut send, _recv) = endpoint.open_bi(peer).await?;
    let message = format!("{text}\n");
    let msg_bytes = message.as_bytes();
    send.write_all(msg_bytes).await?;
    Ok(())
}

pub async fn read_messages(endpoint: &Endpoint) -> rustp2p_quic::Result<(PeerId, String)> {
    let mut incoming = endpoint.accept_bi().await?;
    let bytes = incoming.recv.read_to_end(64 * 1024).await?;
    let text = String::from_utf8_lossy(&bytes).to_string();
    Ok((incoming.peer_id, text))
}
