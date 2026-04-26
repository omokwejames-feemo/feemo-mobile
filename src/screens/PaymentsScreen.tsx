import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBudgetStore } from '../store/budgetStore'
import { formatCurrency } from '../utils/formatCurrency'
import { colors, spacing, radius, font } from '../utils/theme'
import Header from '../components/Header'

const STATUS_COLORS: Record<string, string> = {
  draft: colors.muted,
  exported: colors.warning,
  approved: colors.success,
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  exported: 'Exported',
  approved: 'Approved',
}

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets()
  const { project, paymentSchedules, expenditureDeductions } = useBudgetStore()

  const totalScheduled = paymentSchedules.reduce(
    (sum, ps) => sum + ps.rows.reduce((s, r) => s + r.paymentValue, 0),
    0
  )
  const totalApproved = paymentSchedules
    .filter((ps) => ps.status === 'approved')
    .reduce((sum, ps) => sum + ps.rows.reduce((s, r) => s + r.paymentValue, 0), 0)
  const totalDeducted = expenditureDeductions.reduce((s, d) => s + d.amount, 0)

  const hasSchedules = paymentSchedules.length > 0

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header
        title="Payments"
        subtitle={`${paymentSchedules.length} schedule${paymentSchedules.length !== 1 ? 's' : ''}`}
      />

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Scheduled</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {formatCurrency(totalScheduled, project.currency)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Approved</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {formatCurrency(totalApproved, project.currency)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Deducted</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>
            {formatCurrency(totalDeducted, project.currency)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {!hasSchedules ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No payment schedules</Text>
            <Text style={styles.emptyText}>
              Payment schedules created on the desktop app will appear here after syncing.
            </Text>
          </View>
        ) : (
          paymentSchedules.map((ps) => {
            const total = ps.rows.reduce((s, r) => s + r.paymentValue, 0)
            const statusColor = STATUS_COLORS[ps.status] ?? colors.muted
            const payees = [...new Set(ps.rows.map((r) => r.payeeName))].slice(0, 3)

            return (
              <TouchableOpacity key={ps.id} style={styles.card} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.schedNumber}>{ps.scheduleNumber}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {STATUS_LABELS[ps.status]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardDate}>
                    {new Date(ps.createdAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.metaLabel}>{ps.rows.length} line{ps.rows.length !== 1 ? 's' : ''}</Text>
                    {payees.length > 0 && (
                      <Text style={styles.payees} numberOfLines={1}>
                        {payees.join(', ')}{ps.rows.length > 3 ? `…` : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.totalAmount}>
                    {formatCurrency(total, project.currency)}
                  </Text>
                </View>

                {/* VAT/WHT row */}
                <View style={styles.taxRow}>
                  <Text style={styles.taxText}>VAT {ps.globalVatRate}%</Text>
                  <Text style={styles.taxSep}>·</Text>
                  <Text style={styles.taxText}>WHT {ps.globalWhtRate}%</Text>
                  {ps.signatureDetected && (
                    <>
                      <Text style={styles.taxSep}>·</Text>
                      <Text style={[styles.taxText, { color: colors.success }]}>✓ Signed</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            )
          })
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { color: colors.muted, fontSize: font.xs, marginBottom: 4 },
  summaryValue: { fontSize: font.base, fontWeight: '700' },

  list: { paddingHorizontal: spacing.md },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: font.md, fontWeight: '600', marginBottom: spacing.sm },
  emptyText: { color: colors.muted, fontSize: font.sm, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: { padding: spacing.md, paddingBottom: spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  schedNumber: { color: colors.text, fontSize: font.base, fontWeight: '700', flex: 1 },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  cardDate: { color: colors.muted, fontSize: font.xs },
  cardDivider: { height: 1, backgroundColor: colors.border },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  metaLabel: { color: colors.muted, fontSize: font.xs },
  payees: { color: colors.subtle, fontSize: font.xs, marginTop: 2, maxWidth: 180 },
  totalAmount: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  taxText: { color: colors.muted, fontSize: font.xs },
  taxSep: { color: colors.border, fontSize: font.xs },
})
