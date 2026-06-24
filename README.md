# Queue Cure '26

Welcome to Queue Cure '26 - a beautifully designed, real-time digital queue management system. We built this to say goodbye to messy paper tokens and crowded, chaotic waiting rooms. It features a powerful Receptionist Dashboard to manage the flow of patients, paired with a stunning, animated Patient Display that keeps everyone informed and relaxed.

## Tech Stack

- Frontend: React (powered by Vite)
- Styling & Animations: Pure CSS (Glassmorphism design) + Framer Motion for buttery smooth transitions
- Backend: Node.js with Express.js
- Real-Time Engine: Socket.io (for instant updates between receptionist and patients)
- Database: SQLite3 (better-sqlite3 for blazingly fast local storage)
- Voice: Web Speech API for automated token announcements

## Key Features

- Live Token Generation: Add patients and instantly issue them a spot in the queue.
- Smart Wait Time Estimation: Use a live slider to adjust the average consultation time. The system automatically recalculates estimated wait times for everyone in the room!
- Dynamic Greeting Display: When the queue is empty, the Patient Screen shows a warm, time-aware greeting (e.g., "Good Morning!" or "Good Evening!").
- Pause the Queue: Doctor needs a break? Pause the queue for 1, 5, 10, or 30 minutes. The patient screen immediately shows a friendly "Doctor Busy" banner and adjusts their wait times.
- Early & Late Tracking: The system knows if a consultation is finishing early or running late, and updates the patient display dynamically.
- Automated Voice Announcements: A built-in text-to-speech voice naturally calls out the patient's token when it is their turn.
- CSV Data Export: Download the entire day's queue history into a neat CSV file with one click.
- One-Click Reset: Clear the queue data and cleanly restart the sequence whenever you're ready for a new day.

---

## How to Run Locally (VS Code)

It's super easy to get started! You'll just need to run the backend and the frontend side by side.

### 1. Prerequisites
Make sure you have Node.js (v18 or higher) installed on your system. 

### 2. Start the Backend Server
1. Open a new terminal in VS Code.
2. Navigate to the server folder: cd server
3. Install dependencies: npm install
4. Start the server: node index.js
(You should see "Server listening on port 3001" and the SQLite database will be initialized automatically).

### 3. Start the Frontend Client
1. Open a second terminal panel in VS Code.
2. Navigate to the client folder: cd client
3. Install dependencies: npm install
4. Start the app: npm run dev

### 4. Open the App
Once everything is running, open your browser:
- Welcome Portal: http://localhost:5173/
- Receptionist Dashboard: http://localhost:5173/receptionist.html
- Patient TV Display: http://localhost:5173/patient.html

(Tip: You can snap them side-by-side on your monitor or cast the Patient Screen to a waiting room TV!)
