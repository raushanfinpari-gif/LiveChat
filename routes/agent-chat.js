import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getDataFile (roomId) {
  const name = roomId ? `agent-chat-${roomId}.json` : 'agent-chat.json'
  return path.join(process.cwd(), 'data', name)
}

function getToken (roomId) {
  const envKey = roomId ? `AGENT_CHAT_TOKEN_${roomId.toUpperCase()}` : 'AGENT_CHAT_TOKEN'
  return process.env[envKey] || process.env.AGENT_CHAT_TOKEN || ''
}

const rooms = new Map() // roomId -> { messages, nextId }

function loadRoom (roomId) {
  const dataFile = getDataFile(roomId)
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8')
      const messages = JSON.parse(raw)
      if (!Array.isArray(messages)) return { messages: [], nextId: 1 }
      const maxId = messages.reduce((max, m) => Math.max(max, m.id || 0), 0)
      return { messages, nextId: maxId + 1 }
    }
  } catch (err) {
    console.error(`[agent-chat] Failed to load room ${roomId || 'default'}:`, err.message)
  }
  return { messages: [], nextId: 1 }
}

function persistRoom (roomId, messages) {
  const dataFile = getDataFile(roomId)
  try {
    const tmp = `${dataFile}.tmp.${process.pid}.${Date.now()}`
    fs.writeFileSync(tmp, JSON.stringify(messages, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, dataFile)
  } catch (err) {
    console.error(`[agent-chat] Failed to persist room ${roomId || 'default'}:`, err.message)
  }
}

function getRoom (roomId) {
  if (!rooms.has(roomId)) {
    const { messages, nextId } = loadRoom(roomId)
    rooms.set(roomId, { messages, nextId })
  }
  return rooms.get(roomId)
}

function requireAgentChatToken (req, res, next) {
  const roomId = req.params.roomId || ''
  const token = getToken(roomId)

  if (!token || token.length < 24) {
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

  if (provided.length !== token.length) {
    console.warn(`[agent-chat] Blocked request to ${req.path} from ${req.ip || req.connection?.remoteAddress}`)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token.'
    })
  }

  let ok = false
  try {
    ok = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
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

export default function agentChatRoutes (app) {
  // Public UI pages
  app.get('/agent-chat/ui', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'))
  })
  app.get('/agent-chat/chat.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat.js'))
  })

  // Room UI
  app.get('/agent-chat/room/:roomId/ui', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'))
  })

  // Default room API (backward compatible)
  mountRoomApi(app, '')

  // Named room API
  mountRoomApi(app, '/room/:roomId')
}

function mountRoomApi (app, prefix) {
  const base = prefix ? '/agent-chat' + prefix : '/agent-chat'

  app.post(`${base}/send`, requireAgentChatToken, (req, res) => {
    const roomId = req.params.roomId || ''
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

    const room = getRoom(roomId)
    const message = {
      id: room.nextId++,
      sender: sender.trim().slice(0, 64),
      text: sanitizedText.trim(),
      task: task && typeof task === 'string' ? task.trim().slice(0, 128) : undefined,
      createdAt: new Date().toISOString()
    }

    room.messages.push(message)
    persistRoom(roomId, room.messages)

    console.log(`[agent-chat] [${roomId || 'default'}] #${message.id} from ${message.sender}: ${message.text.slice(0, 80)}`)
    res.json({ id: message.id, createdAt: message.createdAt })
  })

  app.get(`${base}/messages`, requireAgentChatToken, (req, res) => {
    const roomId = req.params.roomId || ''
    const after = parseInt(req.query.after, 10)
    const room = getRoom(roomId)
    let result
    if (!Number.isNaN(after)) {
      result = room.messages.filter(m => m.id > after)
    } else {
      result = room.messages.slice(-100)
    }
    res.json({ messages: result })
  })

  app.get(`${base}/status`, requireAgentChatToken, (req, res) => {
    const roomId = req.params.roomId || ''
    const room = getRoom(roomId)
    const lastMessage = room.messages.length > 0 ? room.messages[room.messages.length - 1] : null
    res.json({
      count: room.messages.length,
      lastId: lastMessage ? lastMessage.id : 0,
      lastMessageAt: lastMessage ? lastMessage.createdAt : null
    })
  })
}
