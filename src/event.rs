// src/event.rs
pub enum Event {
    // a message came in from a peer
    Incoming { from: String, text: String },
    // you sent a message
    Sent { text: String },
    // a status line to show in the chat, like "connected as murmur"
    Status(String),
    // something went wrong
    Error(String),
}