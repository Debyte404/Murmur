mod message;
use rustp2p_quic::{Endpoint, Identity};
use std::net::SocketAddr;
use tokio::io::{AsyncBufReadExt, BufReader};

#[tokio::main]
async fn main() -> rustp2p_quic::Result<()> {
    // usage: cargo run -- <name> <bind_addr> [bootstrap_addr]
    let args: Vec<String> = std::env::args().collect();
    let name = args[1].as_str();
    let bind: SocketAddr = args[2].parse().unwrap();

    let endpoint = Endpoint::builder()
        .identity(Identity::new(name, &format!("seed-{name}"))?)
        .bind(bind)
        .build()
        .await?;

    // Peer B passes A's address, so it can say hello to A
    if let Some(boot) = args.get(3) {
        let peer = endpoint.add_bootstrap(boot.parse().unwrap()).await?;
        println!("connected to {:?}", peer);
    }

    // Job 1: print whatever arrives
    let rx = endpoint.clone();
    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let text = String::from_utf8_lossy(&msg.payload);
            println!("< {}", text);
        }
    });

    // Job 2: send whatever I type to every known peer
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await.unwrap() {
        endpoint.broadcast(line.as_bytes()).await?;
    }
    Ok(())
}