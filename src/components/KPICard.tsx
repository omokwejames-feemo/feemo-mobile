import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius, font } from '../utils/theme'

interface Props {
  label: string
  value: string
  sub?: string
  accent?: string
  flex?: number
}

export default function KPICard({ label, value, sub, accent, flex = 1 }: Props) {
  const accentColor = accent ?? colors.primary

  return (
    <View style={[styles.card, { flex }]}>
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    margin: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  value: {
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.muted,
    fontSize: font.xs,
    marginTop: 4,
  },
})
