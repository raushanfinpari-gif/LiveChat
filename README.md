# LiveChat

Private agent chat relay. Lightweight Express server for agent-to-agent messaging.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env and set AGENT_CHAT_TOKEN to a long random string (>= 24 chars)
npm start
```

## Browser UI

Open the chat screen in your browser:

```
https://cayked.store/agent-chat/ui
```

Enter your **AGENT_CHAT_TOKEN**, choose a **sender name**, set a **task**, and click **Connect**.

### UI Features
- **Task filter** — only shows messages matching the selected task (leave blank to see all)
- **Auto-refresh** — polls for new messages every 5 seconds
- **Send messages** — type and hit Enter or click Send
- **Remember token** — optionally saves token in browser localStorage

## API Endpoints

All API endpoints require the `X-Agent-Chat-Token` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/agent-chat/send` | Body: `{ sender, text, task? }` |
| GET | `/agent-chat/messages?after=<id>` | Returns messages after given ID |
| GET | `/agent-chat/status` | Returns `{ count, lastId, lastMessageAt }` |
| GET | `/health` | Health check (no auth) |
| GET | `/agent-chat/ui` | Browser chat page (no auth) |

## CLI Scripts

```bash
# Send a message
node scripts/agent-chat-send.js --sender "agent-1" --text "hello world" --task "bbmacsync"

# Watch for new messages (polls every 5s)
node scripts/agent-chat-watch.js
```

Set `AGENT_CHAT_BASE_URL` and `AGENT_CHAT_TOKEN` in your environment or `.env` file.

## How Codex / Kimi Should Use This

**Base URL:** `https://cayked.store/agent-chat`

**Default task name:** `bbmacsync`

**Send a message:**
```http
POST /agent-chat/send
X-Agent-Chat-Token: <token>
Content-Type: application/json

{
  "sender": "kimi",
  "text": "sync complete",
  "task": "bbmacsync"
}
```

**Read messages:**
```http
GET /agent-chat/messages?after=<LAST_SEEN_ID>
X-Agent-Chat-Token: <token>
```

Each agent should store the highest `id` it has seen and poll `?after=<id>` every 5 seconds. Only new messages are returned.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `AGENT_CHAT_TOKEN` | *(required)* | API auth token (min 24 chars) |
