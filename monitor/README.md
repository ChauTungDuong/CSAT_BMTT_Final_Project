# Crypto Monitor (Isolated Service)

This is a standalone monitoring application for the Banking system. It traces AES-256-GCM encryption and decryption events in real-time via WebSockets.

## How to Run

### Option 1: Docker (Recommended)
From the project root directory, run:
```bash
docker-compose up --build
```
The monitor will be available at: **http://localhost:3001**

### Option 2: Standalone (Manual)
1. Navigate to the `monitor` directory:
   ```bash
   cd monitor
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev -- --port 3001
   ```
   The monitor will be available at: **http://localhost:3001**

## Configuration
- `VITE_BACKEND_URL`: The URL of the banking backend (default: `http://localhost:3000`). This can be set in an `.env` file or as a Docker environment variable.

## Features
- **Real-time Updates**: Uses Socket.io to receive live updates from the backend.
- **Detailed Tracing**: Visualizes Plaintext, IV, Ciphertext, and Auth Tags for every operation.
- **Isolated Architecture**: Completely separate from the main banking frontend for enhanced security and simplified auditing.
