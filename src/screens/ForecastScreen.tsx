import React, { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBudgetStore, DEPARTMENTS } from '../store/budgetStore'
import { formatCurrency } from '../utils/formatCurrency'
import { colors, spacing, radius, font } from '../utils/theme'
import Header from '../components/Header'
import KPICard from '../components/KPICard'

interface MonthData {
  label: string
  phase: string
  phaseColor: string
  budgeted: number
  spent: number
}

export default function ForecastScreen() {
  const { project, timeline, deptAllocations, expenditureDeductions } = useBudgetStore()

  const months = useMemo<MonthData[]>(() => {
    const result: MonthData[] = []
    const phases: { label: string; months: number; color: string }[] = [
      { label: 'Dev', months: timeline.developmentMonths, color: colors.muted },
      { label: 'Pre-Prod', months: timeline.preProdMonths, color: '#6366f1' },
      { label: 'Shoot', months: timeline.shootMonths, color: colors.primary },
      { label: 'Post', months: timeline.postMonths, color: colors.success },
    ]

    const totalBudgeted = project.totalBudget
    const totalMonths = phases.reduce((a, p) => a + p.months, 0)
    const monthlyBudget = totalMonths > 0 ? totalBudgeted / totalMonths : 0

    let idx = 0
    for (const phase of phases) {
      for (let m = 0; m < phase.months; m++) {
        const start = new Date(project.startDate || '2025-01-01')
        start.setMonth(start.getMonth() + idx)
        result.push({
          label: start.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
          phase: phase.label,
          phaseColor: phase.color,
          budgeted: monthlyBudget,
          spent: 0,
        })
        idx++
      }
    }
    return result
  }, [project, timeline])

  const totalBudgeted = months.reduce((a, m) => a + m.budgeted, 0)
  const totalSpent = expenditureDeductions.reduce((a, d) => a + d.amount, 0)
  const variance = totalBudgeted - totalSpent
  const maxValue = Math.max(...months.map((m) => Math.max(m.budgeted, m.spent)), 1)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header
        title="Forecast"
        subtitle="Monthly cashflow view"
      />

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <KPICard
          label="Total Budget"
          value={formatCurrency(totalBudgeted, project.currency)}
          accent={colors.primary}
        />
        <KPICard
          label="Total Spent"
          value={formatCurrency(totalSpent, project.currency)}
          accent={colors.warning}
        />
        <KPICard
          label="Variance"
          value={formatCurrency(Math.abs(variance), project.currency)}
          sub={variance >= 0 ? 'under budget' : 'OVER budget'}
          accent={variance >= 0 ? colors.success : colors.danger}
        />
      </View>

      {/* Chart */}
      <Text style={styles.chartTitle}>Monthly Budget Distribution</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {months.map((month, i) => {
          const barH = Math.max((month.budgeted / maxValue) * 120, 4)
          const spentH = Math.max((month.spent / maxValue) * 120, 0)
          return (
            <View key={i} style={styles.barGroup}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: month.phaseColor + '55',
                      borderColor: month.phaseColor,
                    },
                  ]}
                />
                {spentH > 0 && (
                  <View
                    style={[
                      styles.barSpent,
                      { height: spentH, bottom: 0 },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.barPhase}>{month.label}</Text>
              <View style={[styles.phaseDot, { backgroundColor: month.phaseColor }]} />
            </View>
          )
        })}
      </ScrollView>

      {/* Phase legend */}
      <View style={styles.legend}>
        {[
          { label: 'Dev', color: colors.muted },
          { label: 'Pre-Prod', color: '#6366f1' },
          { label: 'Shoot', color: colors.primary },
          { label: 'Post', color: colors.success },
        ].map((p) => (
          <View key={p.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>{p.label}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Spent</Text>
        </View>
      </View>

      {/* Monthly breakdown */}
      <ScrollView contentContainerStyle={styles.breakdownList} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Monthly Breakdown</Text>
        {months.map((month, i) => (
          <View key={i} style={styles.monthRow}>
            <View style={[styles.monthPhaseBar, { backgroundColor: month.phaseColor }]} />
            <View style={styles.monthInfo}>
              <Text style={styles.monthLabel}>{month.label}</Text>
              <Text style={[styles.monthPhase, { color: month.phaseColor }]}>{month.phase}</Text>
            </View>
            <View style={styles.monthAmounts}>
              <Text style={styles.monthBudgeted}>
                {formatCurrency(month.budgeted, project.currency)}
              </Text>
              {month.spent > 0 && (
                <Text style={[styles.monthSpent, { color: colors.warning }]}>
                  {formatCurrency(month.spent, project.currency)} spent
                </Text>
              )}
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

  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },

  chartTitle: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chartScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: 4,
  },
  barGroup: { alignItems: 'center', width: 44 },
  barContainer: { width: 32, height: 120, justifyContent: 'flex-end', position: 'relative' },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    position: 'absolute',
    bottom: 0,
  },
  barSpent: {
    position: 'absolute',
    width: '100%',
    backgroundColor: colors.warning + '88',
    borderRadius: radius.sm,
  },
  barPhase: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'center' },
  phaseDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: font.xs },

  breakdownList: { paddingHorizontal: spacing.md },
  sectionLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  monthPhaseBar: { width: 3, height: '100%', minHeight: 48 },
  monthInfo: { flex: 1, padding: spacing.md },
  monthLabel: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  monthPhase: { fontSize: font.xs, marginTop: 2 },
  monthAmounts: { paddingRight: spacing.md, alignItems: 'flex-end' },
  monthBudgeted: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  monthSpent: { fontSize: font.xs, marginTop: 2 },
})
