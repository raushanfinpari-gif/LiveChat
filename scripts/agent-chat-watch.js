#!/usr/bin/env node
import https from 'https'
import http from 'http'
import { URL } from 'url'

const INTERVAL_MS = 5000

function request (url, options) {
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
    req.end()
  })
}

async function fetchMessages (baseUrl, token, after) {
  const url = new URL(`/agent-chat/messages?after=${after}`, baseUrl)
  return request(url, { method: 'GET', headers: { 'X-Agent-Chat-Token': token } })
}

async function main () {
  const baseUrl = process.env.AGENT_CHAT_BASE_URL || 'http://localhost:3000'
  const token = process.env.AGENT_CHAT_TOKEN

  if (!token) {
    console.error('Error: AGENT_CHAT_TOKEN is not set.')
    process.exit(1)
  }

  let lastId = 0

  try {
    const res = await fetchMessages(baseUrl, token, 0)
    if (res.status === 200 && Array.isArray(res.body.messages)) {
      for (const m of res.body.messages) {
        const taskStr = m.task ? ` (task: ${m.task})` : ''
        console.log(`[${m.createdAt}] ${m.sender}: ${m.text}${taskStr}`)
        if (m.id > lastId) lastId = m.id
      }
      if (res.body.messages.length > 0) console.log('--- watching for new messages ---')
    }
  } catch (err) {
    console.error('Initial fetch failed:', err.message)
  }

  const poll = async () => {
    try {
      const res = await fetchMessages(baseUrl, token, lastId)
      if (res.status === 200 && Array.isArray(res.body.messages)) {
        for (const m of res.body.messages) {
          const taskStr = m.task ? ` (task: ${m.task})` : ''
          console.log(`[${m.createdAt}] ${m.sender}: ${m.text}${taskStr}`)
          if (m.id > lastId) lastId = m.id
        }
      } else if (res.status === 401) {
        console.error('Authentication failed. Check AGENT_CHAT_TOKEN.')
      }
    } catch (err) {
      console.error('Poll error:', err.message)
    }
  }

  const intervalId = setInterval(poll, INTERVAL_MS)

  process.on('SIGINT', () => {
    console.log('\nStopped watching.')
    clearInterval(intervalId)
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    clearInterval(intervalId)
    process.exit(0)
  })
}

main()
