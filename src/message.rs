use rustp2p_quic::{Endpoint, PeerId};

pub async fn send_message(endpoint: &Endpoint, peer: PeerId, text: &str) -> rustp2p_quic::Result<()> {
    let (mut send, _recv) = endpoint.open_bi(peer).await?;
    let message = format!("{text}\n");
    let msg_bytes =  message.as_bytes();
    send.write_all(msg_bytes).await?;
    send.finish()?;
    Ok(())
}

pub async fn read_messages(endpoint: &Endpoint) -> rustp2p_quic::Result<String>{
    let mut incoming = endpoint.accept_bi().await?;
    let mut data = Vec::new();
    let mut buf = [0u8; 1024];
    
    // read chunks until the sender finishes the stream
    while let Some(n) = incoming.recv.read(&mut buf).await? {
        data.extend_from_slice(&buf[..n]);
    }

    let text = String::from_utf8_lossy(&data).trim_end().to_string();
    Ok(text)
}