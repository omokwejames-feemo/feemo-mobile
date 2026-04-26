import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, font } from '../utils/theme'

interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export default function Header({ title, subtitle, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  left: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.sm,
    marginTop: 2,
  },
})
