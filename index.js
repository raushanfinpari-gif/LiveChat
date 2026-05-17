import 'dotenv/config'
import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import cors from 'cors'
import agentChatRoutes from './routes/agent-chat.js'

const app = express()

app.set('trust proxy', 1)
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }))
app.use(helmet())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// Mount agent chat relay
agentChatRoutes(app)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`LiveChat relay running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
