import { getValidAccessToken } from './googleAuth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'Feemo Budget Manager'
const FILE_EXT = '.feemo'

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size: string
}

// ─── auth header helper ───────────────────────────────────────────────────────

async function authHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ─── folder ───────────────────────────────────────────────────────────────────

export async function findOrCreateFolder(): Promise<string> {
  const headers = await authHeaders()

  // Search for existing folder
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const listRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, { headers })
  if (!listRes.ok) throw new Error(`Drive folder search failed: ${listRes.status}`)
  const listData = await listRes.json()

  if (listData.files?.length > 0) return listData.files[0].id

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  if (!createRes.ok) throw new Error(`Drive folder creation failed: ${createRes.status}`)
  const folder = await createRes.json()
  return folder.id
}

// ─── list .feemo files ────────────────────────────────────────────────────────

export async function listFeemoFiles(folderId: string): Promise<DriveFile[]> {
  const headers = await authHeaders()
  const q = encodeURIComponent(
    `'${folderId}' in parents and name contains '${FILE_EXT}' and trashed=false`
  )
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    { headers }
  )
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`)
  const data = await res.json()
  return data.files ?? []
}

// ─── download ─────────────────────────────────────────────────────────────────

export async function downloadFeemoFile(fileId: string): Promise<Record<string, unknown>> {
  const headers = await authHeaders()
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers })
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`)
  const text = await res.text()
  return JSON.parse(text)
}

// ─── upload / upsert ─────────────────────────────────────────────────────────

export async function uploadFeemoFile(
  folderId: string,
  fileName: string,
  data: Record<string, unknown>,
  existingFileId?: string | null
): Promise<string> {
  const token = await getValidAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const body = JSON.stringify(data)
  const blob = new Blob([body], { type: 'application/json' })

  if (existingFileId) {
    // Update existing file
    const res = await fetch(
      `${UPLOAD_API}/files/${existingFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      }
    )
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`)
    return existingFileId
  }

  // Create new file with multipart upload
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] })
  const boundary = 'feemo_boundary'
  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipart,
  })
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
  const created = await res.json()
  return created.id
}

// ─── high-level sync helpers ──────────────────────────────────────────────────

export interface SyncResult {
  fileId: string
  fileName: string
  modifiedTime: string
  data: Record<string, unknown>
}

/** Pull the most recently modified .feemo file from Drive */
export async function pullFromDrive(): Promise<SyncResult> {
  const folderId = await findOrCreateFolder()
  const files = await listFeemoFiles(folderId)
  if (files.length === 0) throw new Error('NO_FILES')
  const latest = files[0]
  const data = await downloadFeemoFile(latest.id)
  return { fileId: latest.id, fileName: latest.name, modifiedTime: latest.modifiedTime, data }
}

/** Push current project state to Drive */
export async function pushToDrive(
  projectTitle: string,
  state: Record<string, unknown>,
  existingFileId?: string | null
): Promise<string> {
  const folderId = await findOrCreateFolder()
  const fileName = `${projectTitle || 'Untitled'}${FILE_EXT}`
  return uploadFeemoFile(folderId, fileName, state, existingFileId)
}
