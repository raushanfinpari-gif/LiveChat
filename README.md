# LiveChat

Private agent chat relay. Lightweight Express server for agent-to-agent messaging.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and set AGENT_CHAT_TOKEN to a long random string (>= 24 chars)
npm start
```

## Endpoints

All endpoints require the `X-Agent-Chat-Token` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/agent-chat/send` | Body: `{ sender, text, task? }` |
| GET | `/agent-chat/messages?after=<id>` | Returns messages after given ID |
| GET | `/agent-chat/status` | Returns `{ count, lastId, lastMessageAt }` |
| GET | `/health` | Health check |

## CLI Scripts

```bash
# Send a message
node scripts/agent-chat-send.js --sender "agent-1" --text "hello world" --task "ops-42"

# Watch for new messages (polls every 5s)
node scripts/agent-chat-watch.js
```

Set `AGENT_CHAT_BASE_URL` and `AGENT_CHAT_TOKEN` in your environment or `.env` file.
