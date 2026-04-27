import React from 'react'
import { Platform } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'

import HomeScreen from './src/screens/HomeScreen'
import BudgetScreen from './src/screens/BudgetScreen'
import ForecastScreen from './src/screens/ForecastScreen'
import PaymentsScreen from './src/screens/PaymentsScreen'
import SyncScreen from './src/screens/SyncScreen'
import { colors, font } from './src/utils/theme'

const Tab = createBottomTabNavigator()

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    text: colors.text,
  },
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:     { active: 'home',          inactive: 'home-outline' },
  Budget:   { active: 'pie-chart',     inactive: 'pie-chart-outline' },
  Forecast: { active: 'trending-up',   inactive: 'trending-up-outline' },
  Payments: { active: 'card',          inactive: 'card-outline' },
  Sync:     { active: 'cloud-upload',  inactive: 'cloud-upload-outline' },
}

function AppTabs() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = (Platform.OS === 'ios' ? 60 : 56) + insets.bottom

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: font.xs,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name]
          const iconName = focused ? icons.active : icons.inactive
          return <Ionicons name={iconName} size={size - 2} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Budget"   component={BudgetScreen} />
      <Tab.Screen name="Forecast" component={ForecastScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Sync"     component={SyncScreen} />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <NavigationContainer theme={NavTheme}>
        <AppTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
