import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(process.cwd(), 'data', 'agent-chat.json')
const TOKEN = process.env.AGENT_CHAT_TOKEN || ''

let messages = []
let nextId = 1

function loadMessages () {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8')
      messages = JSON.parse(raw)
      if (!Array.isArray(messages)) messages = []
      const maxId = messages.reduce((max, m) => Math.max(max, m.id || 0), 0)
      nextId = maxId + 1
    } else {
      messages = []
      nextId = 1
      persistMessages()
    }
  } catch (err) {
    console.error('[agent-chat] Failed to load messages:', err.message)
    messages = []
    nextId = 1
  }
}

function persistMessages () {
  try {
    const tmp = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`
    fs.writeFileSync(tmp, JSON.stringify(messages, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, DATA_FILE)
  } catch (err) {
    console.error('[agent-chat] Failed to persist messages:', err.message)
  }
}

function requireAgentChatToken (req, res, next) {
  if (!TOKEN || TOKEN.length < 24) {
    return res.status(500).json({
      error: 'Server Misconfiguration',
      message: 'AGENT_CHAT_TOKEN is not configured or too short (need >= 24 chars).'
    })
  }

  const provided = req.headers['x-agent-chat-token'] || ''
  if (!provided) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Agent-Chat-Token header.'
    })
  }

  if (provided.length !== TOKEN.length) {
    console.warn(`[agent-chat] Blocked request to ${req.path} from ${req.ip || req.connection?.remoteAddress}`)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token.'
    })
  }

  let ok = false
  try {
    ok = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(TOKEN))
  } catch {
    ok = false
  }

  if (!ok) {
    console.warn(`[agent-chat] Blocked request to ${req.path} from ${req.ip || req.connection?.remoteAddress}`)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token.'
    })
  }

  next()
}

loadMessages()

export default function agentChatRoutes (app) {
  // Public UI page
  app.get('/agent-chat/ui', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'))
  })

  // Protected API routes
  app.post('/agent-chat/send', requireAgentChatToken, (req, res) => {
    const { sender, text, task } = req.body || {}

    if (!sender || typeof sender !== 'string') {
      return res.status(400).json({ error: 'sender is required and must be a string.' })
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required and must be a string.' })
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'text exceeds 4000 character limit.' })
    }

    const sanitizedText = text
      .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, '[REDACTED]')

    const message = {
      id: nextId++,
      sender: sender.trim().slice(0, 64),
      text: sanitizedText.trim(),
      task: task && typeof task === 'string' ? task.trim().slice(0, 128) : undefined,
      createdAt: new Date().toISOString()
    }

    messages.push(message)
    persistMessages()

    console.log(`[agent-chat] #${message.id} from ${message.sender}: ${message.text.slice(0, 80)}`)
    res.json({ id: message.id, createdAt: message.createdAt })
  })

  app.get('/agent-chat/messages', requireAgentChatToken, (req, res) => {
    const after = parseInt(req.query.after, 10)
    let result
    if (!Number.isNaN(after)) {
      result = messages.filter(m => m.id > after)
    } else {
      result = messages.slice(-100)
    }
    res.json({ messages: result })
  })

  app.get('/agent-chat/status', requireAgentChatToken, (req, res) => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
    res.json({
      count: messages.length,
      lastId: lastMessage ? lastMessage.id : 0,
      lastMessageAt: lastMessage ? lastMessage.createdAt : null
    })
  })
}
