mod app;
mod config;
mod event;
mod message;
mod network;
mod UI;
use event::Event;
use tokio::sync::mpsc;

#[tokio::main]
async fn main(){

}

const REGISTRY_ADDR: &str = "murmur.debyte.space:9000";

