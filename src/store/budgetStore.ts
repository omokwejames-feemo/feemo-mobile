import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const DEPARTMENTS = [
  { code: 'A', name: 'Research & Development' },
  { code: 'B', name: 'Script' },
  { code: 'C', name: 'Producer' },
  { code: 'D', name: 'Director' },
  { code: 'E', name: 'Talent / Cast' },
  { code: 'F', name: 'Production Staff' },
  { code: 'G', name: 'Camera Department' },
  { code: 'H', name: 'Sound Department' },
  { code: 'I', name: 'Lighting Department' },
  { code: 'J', name: 'Art Department' },
  { code: 'K', name: 'Set Department' },
  { code: 'L', name: 'Props Department' },
  { code: 'M', name: 'Wardrobe' },
  { code: 'N', name: 'Make-up / SFX / Hair' },
  { code: 'O', name: 'Picture Vehicles' },
  { code: 'P', name: 'Studio / OB Facilities' },
  { code: 'Q', name: 'Locations' },
  { code: 'R', name: 'Vehicles' },
  { code: 'S', name: 'Travel' },
  { code: 'T', name: 'Accommodation & Meals' },
  { code: 'AA', name: 'Stock' },
  { code: 'DD', name: 'Graphics' },
  { code: 'EE', name: 'Music' },
  { code: 'FF', name: 'Post Production' },
  { code: 'GG', name: 'Overheads' },
  { code: 'HH', name: 'Insurance' },
  { code: 'II', name: 'Contingency / Production Fee' },
] as const

export type DeptCode = typeof DEPARTMENTS[number]['code']

export interface ProjectDetails {
  title: string
  company: string
  totalBudget: number
  format: string
  shootDays: number
  currency: string
  startDate: string
}

export interface Timeline {
  developmentMonths: number
  preProdMonths: number
  shootMonths: number
  postMonths: number
}

export interface PaymentScheduleRow {
  id: string
  payeeName: string
  description: string
  budgetCode: string
  department: string
  paymentValue: number
  vatRate: number
  whtRate: number
}

export interface PaymentSchedule {
  id: string
  scheduleNumber: string
  globalVatRate: number
  globalWhtRate: number
  rows: PaymentScheduleRow[]
  preparedBy: string
  createdAt: string
  status: 'draft' | 'exported' | 'approved'
  signatureDetected?: boolean
}

export interface ExpenditureDeduction {
  scheduleId: string
  scheduleNumber: string
  budgetCode: string
  department: string
  amount: number
  approvedAt: string
}

export interface SyncRecord {
  lastSyncedAt: string | null
  syncSource: 'google_drive' | 'qr' | null
  driveFileId: string | null
  isOnline: boolean
}

export interface MobileState {
  project: ProjectDetails
  timeline: Timeline
  deptAllocations: Record<string, number>
  paymentSchedules: PaymentSchedule[]
  expenditureDeductions: ExpenditureDeduction[]
  sync: SyncRecord

  setProject: (p: Partial<ProjectDetails>) => void
  setTimeline: (t: Partial<Timeline>) => void
  setDeptAllocation: (code: string, pct: number) => void
  setSync: (s: Partial<SyncRecord>) => void
  loadFromDesktopExport: (data: Partial<MobileState>) => void
  reset: () => void
}

const defaultProject: ProjectDetails = {
  title: 'Untitled Project',
  company: '',
  totalBudget: 0,
  format: 'Feature Film',
  shootDays: 0,
  currency: 'NGN',
  startDate: '',
}

const defaultTimeline: Timeline = {
  developmentMonths: 1,
  preProdMonths: 2,
  shootMonths: 2,
  postMonths: 3,
}

const defaultAllocations: Record<string, number> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.code, 0])
)

export const useBudgetStore = create<MobileState>()(
  persist(
    (set) => ({
      project: defaultProject,
      timeline: defaultTimeline,
      deptAllocations: defaultAllocations,
      paymentSchedules: [],
      expenditureDeductions: [],
      sync: {
        lastSyncedAt: null,
        syncSource: null,
        driveFileId: null,
        isOnline: false,
      },

      setProject: (p) =>
        set((s) => ({ project: { ...s.project, ...p } })),
      setTimeline: (t) =>
        set((s) => ({ timeline: { ...s.timeline, ...t } })),
      setDeptAllocation: (code, pct) =>
        set((s) => ({ deptAllocations: { ...s.deptAllocations, [code]: pct } })),
      setSync: (sv) =>
        set((s) => ({ sync: { ...s.sync, ...sv } })),
      loadFromDesktopExport: (data) =>
        set((s) => ({ ...s, ...data })),
      reset: () =>
        set({
          project: defaultProject,
          timeline: defaultTimeline,
          deptAllocations: defaultAllocations,
          paymentSchedules: [],
          expenditureDeductions: [],
        }),
    }),
    {
      name: 'feemo-mobile-state',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
