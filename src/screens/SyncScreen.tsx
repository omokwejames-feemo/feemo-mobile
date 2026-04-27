import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useBudgetStore } from '../store/budgetStore'
import { colors, spacing, radius, font } from '../utils/theme'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../components/Header'
import { useGoogleSignIn, loadTokens, clearTokens } from '../utils/googleAuth'
import { pullFromDrive, pushToDrive } from '../utils/driveSync'
import { onFeemoAuthChange, signInWithEmail, signUpWithEmail, signOutFeemo } from '../utils/feemoAuth'
import type { FeemoUser } from '../utils/feemoAuth'
import { pullFromCloud, pushToCloud, subscribeToCloud } from '../utils/feemoSync'

type SyncStatus = 'idle' | 'signing_in' | 'pulling' | 'pushing' | 'success' | 'error'

// ─── Google Drive workflow steps (kept for reference section) ────────────────
interface WorkflowStep {
  icon: string
  title: string
  desc: string
  platform: 'desktop' | 'cloud' | 'mobile'
}

const WORKFLOW: WorkflowStep[] = [
  { icon: '🖥',  title: 'Work on Desktop',  desc: 'Build and edit your production budget in Feemo on Mac or Windows.',                platform: 'desktop' },
  { icon: '☁️', title: 'Save to Drive',     desc: 'File screen → "Save to Google Drive". Uploads your .feemo project file.',          platform: 'cloud'   },
  { icon: '📱',  title: 'Sync on Mobile',   desc: 'Tap "Sync from Drive" below. Feemo downloads and loads the latest file.',           platform: 'mobile'  },
  { icon: '👁',  title: 'Review & Approve', desc: 'View budgets, forecasts, and approve payment schedules from your phone.',           platform: 'mobile'  },
  { icon: '🔄',  title: 'Two-Way Sync',     desc: 'Push changes back to Drive. Desktop picks up updates on next launch.',              platform: 'cloud'   },
]

const PLATFORM_COLORS: Record<string, string> = {
  desktop: '#6366f1',
  cloud:   colors.primary,
  mobile:  colors.success,
}

export default function SyncScreen() {
  const { sync, project, setSync, loadFromDesktopExport } = useBudgetStore()

  // ── Feemo Account state ──────────────────────────────────────────────────────
  const [user, setUser] = useState<FeemoUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [feemoSyncing, setFeemoSyncing] = useState(false)
  const [feemoError, setFeemoError] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const cloudUnsubRef = useRef<(() => void) | null>(null)

  // ── Google Drive state ───────────────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<SyncStatus>('idle')
  const [driveError, setDriveError] = useState('')
  const [isDriveSignedIn, setIsDriveSignedIn] = useState(false)
  const [lastDriveSyncLabel, setLastDriveSyncLabel] = useState('')

  const { signIn: googleSignIn } = useGoogleSignIn()

  // ── Auth listener ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onFeemoAuthChange((u) => setUser(u))
    return unsub
  }, [])

  // ── Cloud subscription when signed in ────────────────────────────────────────
  useEffect(() => {
    // Clean up any existing subscription
    if (cloudUnsubRef.current) {
      cloudUnsubRef.current()
      cloudUnsubRef.current = null
    }

    if (!user) return

    cloudUnsubRef.current = subscribeToCloud(user.uid, (data) => {
      if (!data) return
      const docData = data as {
        state?: Record<string, unknown>
        updatedBy?: string
        updatedAt?: { toDate?: () => Date }
      }
      // Only auto-load if the push came from desktop
      if (docData.state && docData.updatedBy !== 'mobile') {
        loadFromDesktopExport(docData.state as Parameters<typeof loadFromDesktopExport>[0])
        const ts = docData.updatedAt?.toDate?.()
        if (ts) {
          setLastSync(ts.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }))
        }
      }
    })

    return () => {
      cloudUnsubRef.current?.()
      cloudUnsubRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // ── Google Drive token check ──────────────────────────────────────────────────
  useEffect(() => {
    loadTokens().then((t) => setIsDriveSignedIn(!!t))
  }, [])

  useEffect(() => {
    if (sync.lastSyncedAt) {
      setLastDriveSyncLabel(
        new Date(sync.lastSyncedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }),
      )
    }
  }, [sync.lastSyncedAt])

  // ── Feemo Account handlers ────────────────────────────────────────────────────
  async function handleFeemoAuth() {
    if (!email.trim() || !password.trim()) {
      setFeemoError('Email and password are required.')
      return
    }
    setFeemoSyncing(true)
    setFeemoError('')
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else {
        await signUpWithEmail(email.trim(), password)
      }
      setEmail('')
      setPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setFeemoError('Invalid email or password.')
      } else if (msg.includes('email-already-in-use')) {
        setFeemoError('An account with this email already exists.')
      } else if (msg.includes('weak-password')) {
        setFeemoError('Password must be at least 6 characters.')
      } else if (msg.includes('invalid-email')) {
        setFeemoError('Please enter a valid email address.')
      } else {
        setFeemoError(msg)
      }
    } finally {
      setFeemoSyncing(false)
    }
  }

  async function handleFeemoSignOut() {
    await signOutFeemo()
    setLastSync(null)
  }

  async function handleFeemoPull() {
    if (!user) return
    setFeemoSyncing(true)
    setFeemoError('')
    try {
      const result = await pullFromCloud(user.uid)
      if (!result.success) {
        setFeemoError(result.error ?? 'Pull failed.')
        return
      }
      if (!result.data) {
        Alert.alert('No data', 'No project found in the cloud yet. Push from the desktop first.')
        return
      }
      loadFromDesktopExport(result.data as Parameters<typeof loadFromDesktopExport>[0])
      const now = new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
      setLastSync(now)
      Alert.alert('Sync Complete', 'Latest desktop project loaded.')
    } catch (err) {
      setFeemoError(err instanceof Error ? err.message : 'Pull failed.')
    } finally {
      setFeemoSyncing(false)
    }
  }

  async function handleFeemoPush() {
    if (!user) return
    setFeemoSyncing(true)
    setFeemoError('')
    try {
      const s = useBudgetStore.getState()
      const state = {
        project: s.project,
        timeline: s.timeline,
        deptAllocations: s.deptAllocations,
        paymentSchedules: s.paymentSchedules,
        expenditureDeductions: s.expenditureDeductions,
      }
      const result = await pushToCloud(user.uid, state as Record<string, unknown>, 'mobile')
      if (!result.success) {
        setFeemoError(result.error ?? 'Push failed.')
        return
      }
      const now = new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
      setLastSync(now)
      Alert.alert('Upload Complete', 'Your project has been saved to the cloud.')
    } catch (err) {
      setFeemoError(err instanceof Error ? err.message : 'Push failed.')
    } finally {
      setFeemoSyncing(false)
    }
  }

  // ── Google Drive handlers ─────────────────────────────────────────────────────
  async function handleDriveSignIn() {
    setDriveStatus('signing_in')
    try {
      const tokens = await googleSignIn()
      if (!tokens) { setDriveStatus('idle'); return }
      setIsDriveSignedIn(true)
      setDriveStatus('idle')
    } catch (e: unknown) {
      setDriveStatus('error')
      setDriveError(e instanceof Error ? e.message : 'Sign-in failed')
    }
  }

  async function handleDriveSignOut() {
    await clearTokens()
    setIsDriveSignedIn(false)
    setSync({ lastSyncedAt: null, syncSource: null, driveFileId: null })
  }

  async function handlePullFromDrive() {
    if (!isDriveSignedIn) { await handleDriveSignIn(); return }
    setDriveStatus('pulling')
    setDriveError('')
    try {
      const result = await pullFromDrive()
      loadFromDesktopExport(result.data as Parameters<typeof loadFromDesktopExport>[0])
      setSync({ lastSyncedAt: new Date().toISOString(), syncSource: 'google_drive', driveFileId: result.fileId })
      setDriveStatus('success')
      Alert.alert('Sync Complete', `Loaded "${result.fileName}" from Google Drive.`)
    } catch (e: unknown) {
      setDriveStatus('error')
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'NOT_AUTHENTICATED') { setIsDriveSignedIn(false); setDriveError('Session expired. Please sign in again.') }
      else if (msg === 'NO_FILES') { setDriveError('No .feemo files found in your Drive. Save a project from the desktop app first.') }
      else { setDriveError(msg || 'Sync failed. Check your connection and try again.') }
    }
  }

  async function handlePushToDrive() {
    if (!isDriveSignedIn) { await handleDriveSignIn(); return }
    setDriveStatus('pushing')
    setDriveError('')
    try {
      const state = useBudgetStore.getState()
      const exportData = {
        project: state.project,
        timeline: state.timeline,
        deptAllocations: state.deptAllocations,
        paymentSchedules: state.paymentSchedules,
        expenditureDeductions: state.expenditureDeductions,
      }
      const fileId = await pushToDrive(state.project.title, exportData, sync.driveFileId)
      setSync({ lastSyncedAt: new Date().toISOString(), syncSource: 'google_drive', driveFileId: fileId })
      setDriveStatus('success')
      Alert.alert('Upload Complete', 'Your project has been saved to Google Drive.')
    } catch (e: unknown) {
      setDriveStatus('error')
      setDriveError(e instanceof Error ? e.message : 'Upload failed.')
    }
  }

  const isDriveBusy = driveStatus === 'signing_in' || driveStatus === 'pulling' || driveStatus === 'pushing'

  const driveStatusLabel: Record<SyncStatus, string> = {
    idle: '', signing_in: 'Connecting to Google…', pulling: 'Downloading from Drive…',
    pushing: 'Uploading to Drive…', success: '', error: driveError,
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header title="Sync" subtitle="Desktop ↔ Mobile" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── FEEMO ACCOUNT SECTION ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Feemo Account Sync</Text>

        {user ? (
          /* Signed-in state */
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Connected</Text>
                <Text style={styles.statusSub} numberOfLines={1}>{user.email}</Text>
              </View>
              <TouchableOpacity onPress={handleFeemoSignOut} style={styles.signOutBtn}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>

            {lastSync ? (
              <Text style={[styles.statusSub, { marginTop: spacing.sm }]}>Last sync: {lastSync}</Text>
            ) : null}

            {feemoError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{feemoError}</Text>
              </View>
            ) : null}

            {feemoSyncing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Syncing…</Text>
              </View>
            ) : null}
          </View>
        ) : (
          /* Sign-in form */
          <View style={styles.statusCard}>
            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
                onPress={() => { setMode('signin'); setFeemoError('') }}
              >
                <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
                onPress={() => { setMode('signup'); setFeemoError('') }}
              >
                <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>Create account</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[styles.textInput, { marginBottom: 0 }]}
              placeholder={mode === 'signup' ? 'Password (min. 6 chars)' : 'Password'}
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            {feemoError ? (
              <View style={[styles.errorBanner, { marginTop: spacing.sm }]}>
                <Text style={styles.errorText}>{feemoError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Primary action button */}
        {!user ? (
          <TouchableOpacity
            style={[styles.primaryBtn, feemoSyncing && styles.btnDisabled]}
            onPress={handleFeemoAuth}
            disabled={feemoSyncing}
            activeOpacity={0.8}
          >
            {feemoSyncing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnIcon}>☁</Text>}
            <View>
              <Text style={styles.primaryBtnTitle}>
                {mode === 'signin' ? 'Sign in to Feemo' : 'Create Feemo Account'}
              </Text>
              <Text style={styles.primaryBtnSub}>Real-time cloud sync</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, feemoSyncing && styles.btnDisabled]}
              onPress={handleFeemoPull}
              disabled={feemoSyncing}
              activeOpacity={0.8}
            >
              {feemoSyncing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnIcon}>⬇</Text>}
              <View>
                <Text style={styles.primaryBtnTitle}>Pull latest from desktop</Text>
                <Text style={styles.primaryBtnSub}>Load most recent cloud state</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, feemoSyncing && styles.btnDisabled]}
              onPress={handleFeemoPush}
              disabled={feemoSyncing}
              activeOpacity={0.8}
            >
              {feemoSyncing
                ? <ActivityIndicator color={colors.text} size="small" />
                : <Text style={styles.btnIcon}>⬆</Text>}
              <View>
                <Text style={styles.secondaryBtnTitle}>Push to cloud</Text>
                <Text style={styles.secondaryBtnSub}>Save mobile changes to cloud</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* QR offline */}
        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
          <Text style={styles.btnIcon}>📷</Text>
          <View>
            <Text style={styles.secondaryBtnTitle}>Scan QR Code</Text>
            <Text style={styles.secondaryBtnSub}>Offline local transfer</Text>
          </View>
        </TouchableOpacity>

        {/* ── GOOGLE DRIVE SECTION ─────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Google Drive Sync</Text>

        {/* Google Drive status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: isDriveSignedIn
                ? (sync.lastSyncedAt ? colors.success : colors.primary)
                : colors.warning,
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {isDriveSignedIn
                  ? (sync.lastSyncedAt ? 'Google Drive connected' : 'Signed in — not yet synced')
                  : 'Not connected to Google Drive'}
              </Text>
              <Text style={styles.statusSub}>
                {isDriveSignedIn && sync.lastSyncedAt
                  ? `Last sync: ${lastDriveSyncLabel}`
                  : isDriveSignedIn
                  ? 'Ready to sync'
                  : 'Sign in to pull your desktop project'}
              </Text>
            </View>
            {isDriveSignedIn && (
              <TouchableOpacity onPress={handleDriveSignOut} style={styles.signOutBtn}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            )}
          </View>

          {driveStatus === 'error' && driveError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{driveError}</Text>
            </View>
          ) : null}

          {isDriveBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>{driveStatusLabel[driveStatus]}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, isDriveBusy && styles.btnDisabled]}
          onPress={handlePullFromDrive}
          disabled={isDriveBusy}
          activeOpacity={0.8}
        >
          {driveStatus === 'pulling'
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnIcon}>☁️</Text>}
          <View>
            <Text style={styles.primaryBtnTitle}>
              {isDriveSignedIn ? 'Sync from Google Drive' : 'Connect Google Drive'}
            </Text>
            <Text style={styles.primaryBtnSub}>
              {isDriveSignedIn ? 'Pull latest .feemo file' : 'Sign in to get started'}
            </Text>
          </View>
        </TouchableOpacity>

        {isDriveSignedIn && (
          <TouchableOpacity
            style={[styles.secondaryBtn, isDriveBusy && styles.btnDisabled]}
            onPress={handlePushToDrive}
            disabled={isDriveBusy}
            activeOpacity={0.8}
          >
            {driveStatus === 'pushing'
              ? <ActivityIndicator color={colors.text} size="small" />
              : <Text style={styles.btnIcon}>⬆️</Text>}
            <View>
              <Text style={styles.secondaryBtnTitle}>Push to Google Drive</Text>
              <Text style={styles.secondaryBtnSub}>Upload current changes</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* How it works */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>How Google Drive Sync Works</Text>

        {WORKFLOW.map((step, i) => {
          const color = PLATFORM_COLORS[step.platform]
          const isLast = i === WORKFLOW.length - 1
          return (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[styles.stepBubble, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                </View>
                {!isLast && <View style={[styles.stepLine, { backgroundColor: color + '33' }]} />}
              </View>
              <View style={[styles.stepContent, !isLast && { paddingBottom: spacing.lg }]}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <View style={[styles.platformTag, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.platformTagText, { color }]}>
                      {step.platform.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          )
        })}

        {[
          { icon: '💡', title: 'Enable Drive on Desktop', body: 'Open Feemo → File screen → Save to Google Drive. Use the same Google account on both devices.' },
          { icon: '🔑', title: 'First-time setup', body: "Tap \"Connect Google Drive\" above. You'll be asked to approve access to your Drive — only .feemo files are ever touched." },
        ].map((n) => (
          <View key={n.title} style={styles.noteCard}>
            <Text style={styles.noteIcon}>{n.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>{n.title}</Text>
              <Text style={styles.noteBody}>{n.body}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md },

  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: colors.text, fontSize: font.base, fontWeight: '600' },
  statusSub: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  signOutBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  signOutText: { color: colors.muted, fontSize: font.xs, fontWeight: '600' },
  errorBanner: {
    backgroundColor: colors.danger + '18',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: font.xs },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingText: { color: colors.muted, fontSize: font.xs },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  modeBtnActive: {
    backgroundColor: colors.card,
  },
  modeBtnText: { color: colors.muted, fontSize: font.xs, fontWeight: '600' },
  modeBtnTextActive: { color: colors.text },

  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: font.sm,
    marginBottom: spacing.sm,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: { opacity: 0.5 },
  btnIcon: { fontSize: 24 },
  primaryBtnTitle: { color: '#fff', fontSize: font.base, fontWeight: '700' },
  primaryBtnSub:   { color: '#ffffff99', fontSize: font.xs, marginTop: 2 },
  secondaryBtnTitle: { color: colors.text, fontSize: font.base, fontWeight: '600' },
  secondaryBtnSub:   { color: colors.muted, fontSize: font.xs, marginTop: 2 },

  sectionLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  stepRow: { flexDirection: 'row' },
  stepLeft: { alignItems: 'center', width: 52 },
  stepBubble: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  stepIcon: { fontSize: 18 },
  stepLine: { width: 2, flex: 1, marginTop: 4 },
  stepContent: { flex: 1, paddingLeft: spacing.sm },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: spacing.sm },
  stepTitle: { color: colors.text, fontSize: font.sm, fontWeight: '600', flex: 1 },
  platformTag: { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  platformTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  stepDesc: { color: colors.muted, fontSize: font.xs, lineHeight: 18 },

  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  noteIcon: { fontSize: 20 },
  noteTitle: { color: colors.text, fontSize: font.sm, fontWeight: '600', marginBottom: 4 },
  noteBody: { color: colors.muted, fontSize: font.xs, lineHeight: 18 },
})
