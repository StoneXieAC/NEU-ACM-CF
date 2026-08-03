import { readFile } from 'node:fs/promises'
import type { Member } from './types.js'

export async function loadMembers(path: string): Promise<Member[]> {
  const content = await readFile(path, 'utf8')
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines[0]?.toLowerCase() !== 'name,handle') {
    throw new Error('handle.csv 必须以 name,handle 作为表头')
  }

  const members = lines.slice(1).map((line, index) => {
    const separator = line.indexOf(',')
    const name = separator >= 0 ? line.slice(0, separator).trim() : ''
    const handle = separator >= 0 ? line.slice(separator + 1).trim() : ''
    if (!name || !handle) throw new Error(`handle.csv 第 ${index + 2} 行格式无效`)
    return { name, handle }
  })

  const handles = new Set<string>()
  for (const member of members) {
    const normalized = member.handle.toLowerCase()
    if (handles.has(normalized)) throw new Error(`handle.csv 包含重复 Handle：${member.handle}`)
    handles.add(normalized)
  }

  if (members.length === 0) throw new Error('handle.csv 不能是空名单')
  return members
}
