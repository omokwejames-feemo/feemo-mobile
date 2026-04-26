import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBudgetStore } from '../store/budgetStore'
import { formatCurrency } from '../utils/formatCurrency'
import { colors, spacing, radius, font } from '../utils/theme'

export default function HomeScreen() {
  const { project, timeline, sync, deptAllocations } = useBudgetStore()

  const totalPhaseMonths =
    timeline.developmentMonths +
    timeline.preProdMonths +
    timeline.shootMonths +
    timeline.postMonths

  const allocatedPct = Object.values(deptAllocations).reduce((a, b) => a + b, 0)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero project card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{project.format}</Text>
          </View>
          <Text style={styles.heroTitle}>{project.title}</Text>
          <Text style={styles.heroCompany}>{project.company || 'No company set'}</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {formatCurrency(project.totalBudget, project.currency)}
              </Text>
              <Text style={styles.heroStatLabel}>Total Budget</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{project.shootDays}</Text>
              <Text style={styles.heroStatLabel}>Shoot Days</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{totalPhaseMonths}mo</Text>
              <Text style={styles.heroStatLabel}>Duration</Text>
            </View>
          </View>
        </View>

        {/* Sync status strip */}
        <TouchableOpacity style={styles.syncStrip} activeOpacity={0.8}>
          <View style={[styles.syncDot, { backgroundColor: sync.lastSyncedAt ? colors.success : colors.warning }]} />
          <Text style={styles.syncText}>
            {sync.lastSyncedAt
              ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleDateString()}`
              : 'Not synced with desktop yet'}
          </Text>
          <Text style={styles.syncArrow}>›</Text>
        </TouchableOpacity>

        {/* Phase timeline */}
        <Text style={styles.sectionLabel}>Production Phases</Text>
        <View style={styles.phaseRow}>
          {[
            { label: 'Dev', months: timeline.developmentMonths, color: colors.muted },
            { label: 'Pre-Prod', months: timeline.preProdMonths, color: '#6366f1' },
            { label: 'Shoot', months: timeline.shootMonths, color: colors.primary },
            { label: 'Post', months: timeline.postMonths, color: colors.success },
          ].map((phase) => (
            <View
              key={phase.label}
              style={[
                styles.phaseBlock,
                {
                  flex: phase.months || 1,
                  backgroundColor: phase.color + '22',
                  borderColor: phase.color + '44',
                },
              ]}
            >
              <Text style={[styles.phaseLabel, { color: phase.color }]}>{phase.label}</Text>
              <Text style={[styles.phaseMonths, { color: phase.color }]}>{phase.months}mo</Text>
            </View>
          ))}
        </View>

        {/* Budget allocation ring */}
        <Text style={styles.sectionLabel}>Budget Allocation</Text>
        <View style={styles.allocCard}>
          <View style={styles.allocBar}>
            <View
              style={[
                styles.allocFill,
                {
                  width: `${Math.min(allocatedPct, 100)}%`,
                  backgroundColor:
                    allocatedPct > 100
                      ? colors.danger
                      : allocatedPct === 100
                      ? colors.success
                      : colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.allocRow}>
            <Text style={styles.allocPct}>{allocatedPct.toFixed(1)}% allocated</Text>
            <Text style={[styles.allocStatus, {
              color: allocatedPct === 100 ? colors.success : allocatedPct > 100 ? colors.danger : colors.warning
            }]}>
              {allocatedPct === 100 ? '✓ Balanced' : allocatedPct > 100 ? '⚠ Over 100%' : `${(100 - allocatedPct).toFixed(1)}% unallocated`}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: 'View Budget', icon: '📊', desc: 'Dept allocations' },
            { label: 'Forecast', icon: '📈', desc: 'Monthly cashflow' },
            { label: 'Payments', icon: '💳', desc: 'Payment schedules' },
            { label: 'Sync Desktop', icon: '🔄', desc: 'Google Drive' },
          ].map((action) => (
            <View key={action.label} style={styles.actionCard}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionDesc}>{action.desc}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '22',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  heroBadgeText: { color: colors.primaryLight, fontSize: font.xs, fontWeight: '600' },
  heroTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700', letterSpacing: -0.5 },
  heroCompany: { color: colors.muted, fontSize: font.sm, marginTop: 2, marginBottom: spacing.md },
  heroDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  heroStatLabel: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: colors.border },

  syncStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  syncText: { flex: 1, color: colors.subtle, fontSize: font.sm },
  syncArrow: { color: colors.muted, fontSize: font.lg },

  sectionLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  phaseRow: { flexDirection: 'row', borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.lg, gap: 4 },
  phaseBlock: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 48,
  },
  phaseLabel: { fontSize: font.xs, fontWeight: '600' },
  phaseMonths: { fontSize: font.xs, marginTop: 2 },

  allocCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  allocBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  allocFill: { height: '100%', borderRadius: radius.full },
  allocRow: { flexDirection: 'row', justifyContent: 'space-between' },
  allocPct: { color: colors.subtle, fontSize: font.sm },
  allocStatus: { fontSize: font.sm, fontWeight: '600' },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: '50%',
    padding: spacing.xs,
  },
  actionCardInner: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: { fontSize: 24, marginBottom: spacing.sm },
  actionLabel: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '600',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionDesc: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
})
