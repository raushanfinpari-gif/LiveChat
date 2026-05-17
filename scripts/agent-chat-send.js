#!/usr/bin/env node
import https from 'https'
import http from 'http'
import { URL } from 'url'

function parseArgs () {
  const args = process.argv.slice(2)
  const parsed = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sender' && args[i + 1]) parsed.sender = args[i + 1]
    if (args[i] === '--text' && args[i + 1]) parsed.text = args[i + 1]
    if (args[i] === '--task' && args[i + 1]) parsed.task = args[i + 1]
  }
  return parsed
}

function request (url, options, body) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function main () {
  const args = parseArgs()
  const baseUrl = process.env.AGENT_CHAT_BASE_URL || 'http://localhost:3000'
  const token = process.env.AGENT_CHAT_TOKEN

  if (!token) {
    console.error('Error: AGENT_CHAT_TOKEN is not set.')
    process.exit(1)
  }
  if (!args.sender || !args.text) {
    console.error('Usage: node scripts/agent-chat-send.js --sender <name> --text <message> [--task <id>]')
    process.exit(1)
  }

  const payload = { sender: args.sender, text: args.text, task: args.task }
  const url = new URL('/agent-chat/send', baseUrl)
  const body = JSON.stringify(payload)

  try {
    const res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Agent-Chat-Token': token
      }
    }, body)

    if (res.status >= 200 && res.status < 300) {
      console.log(`Sent. id=${res.body.id} at ${res.body.createdAt}`)
    } else {
      console.error(`Error ${res.status}:`, res.body.error || res.body)
      process.exit(1)
    }
  } catch (err) {
    console.error('Request failed:', err.message)
    process.exit(1)
  }
}

main()
