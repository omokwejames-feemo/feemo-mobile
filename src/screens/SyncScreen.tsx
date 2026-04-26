import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useBudgetStore } from '../store/budgetStore'
import { colors, spacing, radius, font } from '../utils/theme'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../components/Header'
import { useGoogleSignIn, loadTokens, clearTokens, getValidAccessToken } from '../utils/googleAuth'
import { pullFromDrive, pushToDrive } from '../utils/driveSync'

type SyncStatus = 'idle' | 'signing_in' | 'pulling' | 'pushing' | 'success' | 'error'

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
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [lastSyncLabel, setLastSyncLabel] = useState('')

  const { signIn } = useGoogleSignIn()

  // Check token on mount
  useEffect(() => {
    loadTokens().then(t => setIsSignedIn(!!t))
  }, [])

  useEffect(() => {
    if (sync.lastSyncedAt) {
      setLastSyncLabel(new Date(sync.lastSyncedAt).toLocaleString('en-NG', {
        dateStyle: 'medium', timeStyle: 'short',
      }))
    }
  }, [sync.lastSyncedAt])

  async function handleSignIn() {
    setStatus('signing_in')
    try {
      const tokens = await signIn()
      if (!tokens) { setStatus('idle'); return }
      setIsSignedIn(true)
      setStatus('idle')
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message ?? 'Sign-in failed')
    }
  }

  async function handleSignOut() {
    await clearTokens()
    setIsSignedIn(false)
    setSync({ lastSyncedAt: null, syncSource: null, driveFileId: null })
  }

  async function handlePullFromDrive() {
    if (!isSignedIn) { await handleSignIn(); return }
    setStatus('pulling')
    setErrorMsg('')
    try {
      const result = await pullFromDrive()
      // Merge the downloaded state into local store
      loadFromDesktopExport(result.data as any)
      setSync({
        lastSyncedAt: new Date().toISOString(),
        syncSource: 'google_drive',
        driveFileId: result.fileId,
      })
      setStatus('success')
      Alert.alert('Sync Complete', `Loaded "${result.fileName}" from Google Drive.`)
    } catch (e: any) {
      setStatus('error')
      if (e?.message === 'NOT_AUTHENTICATED') {
        setIsSignedIn(false)
        setErrorMsg('Session expired. Please sign in again.')
      } else if (e?.message === 'NO_FILES') {
        setErrorMsg('No .feemo files found in your Drive. Save a project from the desktop app first.')
      } else {
        setErrorMsg(e?.message ?? 'Sync failed. Check your connection and try again.')
      }
    }
  }

  async function handlePushToDrive() {
    if (!isSignedIn) { await handleSignIn(); return }
    setStatus('pushing')
    setErrorMsg('')
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
      setSync({
        lastSyncedAt: new Date().toISOString(),
        syncSource: 'google_drive',
        driveFileId: fileId,
      })
      setStatus('success')
      Alert.alert('Upload Complete', 'Your project has been saved to Google Drive.')
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message ?? 'Upload failed.')
    }
  }

  const isBusy = status === 'signing_in' || status === 'pulling' || status === 'pushing'

  const statusLabel: Record<SyncStatus, string> = {
    idle:       '',
    signing_in: 'Connecting to Google…',
    pulling:    'Downloading from Drive…',
    pushing:    'Uploading to Drive…',
    success:    '',
    error:      errorMsg,
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header title="Sync" subtitle="Desktop ↔ Mobile" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Auth + status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: isSignedIn
                ? (sync.lastSyncedAt ? colors.success : colors.primary)
                : colors.warning,
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {isSignedIn
                  ? (sync.lastSyncedAt ? 'Google Drive connected' : 'Signed in — not yet synced')
                  : 'Not connected to Google Drive'}
              </Text>
              <Text style={styles.statusSub}>
                {isSignedIn && sync.lastSyncedAt
                  ? `Last sync: ${lastSyncLabel}`
                  : isSignedIn
                  ? 'Ready to sync'
                  : 'Sign in to pull your desktop project'}
              </Text>
            </View>
            {isSignedIn && (
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error message */}
          {status === 'error' && errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Loading indicator */}
          {isBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>{statusLabel[status]}</Text>
            </View>
          )}
        </View>

        {/* Primary: Pull from Drive */}
        <TouchableOpacity
          style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
          onPress={handlePullFromDrive}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {status === 'pulling'
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnIcon}>☁️</Text>}
          <View>
            <Text style={styles.primaryBtnTitle}>
              {isSignedIn ? 'Sync from Google Drive' : 'Connect Google Drive'}
            </Text>
            <Text style={styles.primaryBtnSub}>
              {isSignedIn ? 'Pull latest .feemo file' : 'Sign in to get started'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Secondary: Push to Drive */}
        {isSignedIn && (
          <TouchableOpacity
            style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
            onPress={handlePushToDrive}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {status === 'pushing'
              ? <ActivityIndicator color={colors.text} size="small" />
              : <Text style={styles.btnIcon}>⬆️</Text>}
            <View>
              <Text style={styles.secondaryBtnTitle}>Push to Google Drive</Text>
              <Text style={styles.secondaryBtnSub}>Upload current changes</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* QR offline */}
        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
          <Text style={styles.btnIcon}>📷</Text>
          <View>
            <Text style={styles.secondaryBtnTitle}>Scan QR Code</Text>
            <Text style={styles.secondaryBtnSub}>Offline local transfer</Text>
          </View>
        </TouchableOpacity>

        {/* How it works */}
        <Text style={styles.sectionLabel}>How Sync Works</Text>

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

        {/* Setup notes */}
        {[
          { icon: '💡', title: 'Enable Drive on Desktop', body: 'Open Feemo → File screen → Save to Google Drive. Use the same Google account on both devices.' },
          { icon: '🔑', title: 'First-time setup', body: 'Tap "Connect Google Drive" above. You\'ll be asked to approve access to your Drive — only .feemo files are ever touched.' },
        ].map(n => (
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
