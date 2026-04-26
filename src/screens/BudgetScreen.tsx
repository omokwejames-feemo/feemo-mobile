import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { useBudgetStore, DEPARTMENTS } from '../store/budgetStore'
import { formatCurrency } from '../utils/formatCurrency'
import { colors, spacing, radius, font } from '../utils/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Header from '../components/Header'

export default function BudgetScreen() {
  const insets = useSafeAreaInsets()
  const { project, deptAllocations, setDeptAllocation } = useBudgetStore()
  const [search, setSearch] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const totalAllocated = Object.values(deptAllocations).reduce((a, b) => a + b, 0)
  const remaining = 100 - totalAllocated

  const filtered = DEPARTMENTS.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase())
  )

  const statusColor =
    totalAllocated > 100 ? colors.danger :
    totalAllocated === 100 ? colors.success :
    colors.warning

  function commitEdit(code: string) {
    const val = parseFloat(editValue)
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setDeptAllocation(code, val)
    }
    setEditingCode(null)
    setEditValue('')
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header
        title="Budget"
        subtitle={project.title}
        right={
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {totalAllocated.toFixed(1)}%
            </Text>
          </View>
        }
      />

      {/* Summary bar */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatCurrency(project.totalBudget, project.currency)}
          </Text>
          <Text style={styles.summaryLabel}>Total Budget</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: statusColor }]}>
            {totalAllocated.toFixed(1)}%
          </Text>
          <Text style={styles.summaryLabel}>Allocated</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: remaining < 0 ? colors.danger : colors.muted }]}>
            {remaining.toFixed(1)}%
          </Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(totalAllocated, 100)}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search departments…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Department list */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map((dept) => {
          const pct = deptAllocations[dept.code] ?? 0
          const amount = (pct / 100) * project.totalBudget
          const isEditing = editingCode === dept.code
          const barColor =
            pct > 20 ? colors.primary :
            pct > 10 ? colors.primaryLight :
            pct > 0 ? colors.muted :
            colors.border

          return (
            <TouchableOpacity
              key={dept.code}
              style={styles.deptRow}
              onPress={() => {
                setEditingCode(dept.code)
                setEditValue(String(pct))
              }}
              activeOpacity={0.7}
            >
              <View style={styles.deptLeft}>
                <View style={styles.codeTag}>
                  <Text style={styles.codeText}>{dept.code}</Text>
                </View>
                <View style={styles.deptInfo}>
                  <Text style={styles.deptName} numberOfLines={1}>{dept.name}</Text>
                  <Text style={styles.deptAmount}>
                    {amount > 0 ? formatCurrency(amount, project.currency) : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.deptRight}>
                {isEditing ? (
                  <TextInput
                    style={styles.pctInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    autoFocus
                    onBlur={() => commitEdit(dept.code)}
                    onSubmitEditing={() => commitEdit(dept.code)}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={[styles.pctValue, { color: pct > 0 ? colors.primary : colors.muted }]}>
                    {pct > 0 ? `${pct}%` : '—'}
                  </Text>
                )}
              </View>

              {/* Mini bar */}
              <View style={styles.miniBarWrap}>
                <View
                  style={[
                    styles.miniBarFill,
                    { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
            </TouchableOpacity>
          )
        })}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: font.sm, fontWeight: '700' },

  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: colors.text, fontSize: font.base, fontWeight: '700' },
  summaryLabel: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  progressWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  progressBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: font.sm, marginRight: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: font.sm, paddingVertical: spacing.sm },

  list: { paddingHorizontal: spacing.md },

  deptRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  deptLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  codeTag: {
    backgroundColor: colors.primary + '22',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: spacing.sm,
    minWidth: 32,
    alignItems: 'center',
  },
  codeText: { color: colors.primaryLight, fontSize: font.xs, fontWeight: '700' },
  deptInfo: { flex: 1 },
  deptName: { color: colors.text, fontSize: font.sm, fontWeight: '500' },
  deptAmount: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  deptRight: { marginLeft: spacing.sm },
  pctValue: { fontSize: font.base, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  pctInput: {
    color: colors.primary,
    fontSize: font.base,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 0,
  },
  miniBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  miniBarFill: { height: '100%' },
})
