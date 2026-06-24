# Socket.io Event Diagram

A **Socket Event Diagram** is a visual map that shows exactly how your frontend (Vercel) and backend (Render) talk to each other in real-time. Because your app uses WebSockets (Socket.io) instead of traditional HTTP requests, the connection stays open, allowing the server to instantly "push" updates to all screens the moment anything changes.

Here is the exact real-time flow of your **Queue Cure '26** application:

```mermaid
sequenceDiagram
    participant R as Receptionist Screen
    participant S as Node.js Backend (Socket.io)
    participant P as Patient TV Screen

    Note over R,P: Initial Connection
    R->>S: Connects to WebSockets
    P->>S: Connects to WebSockets
    S-->>R: queue_updated (Sends full initial state)
    S-->>P: queue_updated (Sends full initial state)

    Note over R,S: Adding a Patient
    R->>S: emit('add_patient', { name, phone })
    Note right of S: Saves to SQLite DB<br/>Calculates Next Token
    S-->>R: emit('queue_updated', state)
    S-->>P: emit('queue_updated', state)

    Note over R,P: Calling the Next Patient
    R->>S: emit('call_next')
    Note right of S: Updates activeToken<br/>Marks old as completed
    S-->>R: emit('queue_updated', state)
    S-->>P: emit('queue_updated', state)
    Note left of P: Patient TV instantly triggers<br/>Text-to-Speech Voice!

    Note over R,S: Queue Control & Settings
    R->>S: emit('pause_queue', { durationMs })
    S-->>R: emit('queue_updated', state)
    S-->>P: emit('queue_updated', state)
    
    R->>S: emit('update_avg_time', minutes)
    S-->>R: emit('queue_updated', state)
    S-->>P: emit('queue_updated', state)

    Note over R,P: Wiping Data
    R->>S: emit('clear_data')
    Note right of S: Wipes SQLite DB<br/>Resets activeToken
    S-->>R: emit('queue_updated', state)
    S-->>P: emit('queue_updated', state)
```

### Why this is awesome:
In a traditional app, the Patient TV would have to constantly refresh the page every 5 seconds to check if a new patient was called. With this Socket architecture, the Patient TV sits completely idle until the Server pushes a `queue_updated` event to it, making it lightning-fast and incredibly efficient!
