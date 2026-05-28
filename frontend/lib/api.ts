import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number; email: string; full_name: string
  role: 'candidate' | 'recruiter' | 'admin'
  is_active: boolean; is_verified: boolean
}

export interface CandidateProfile extends User {
  headline?: string; bio?: string; location?: string
  linkedin_url?: string; github_url?: string; created_at: string
}

export interface TokenResponse {
  access_token: string; refresh_token: string; token_type: string; expires_in: number
}

export interface ResumeScoreResponse {
  score: number; missing_skills: string[]
  recommended_project: string; summary: string
}

export interface AnalysisSummary {
  id: number; original_filename?: string; score: number
  missing_skills: string[]; recommended_project: string
  summary: string; created_at: string
}

export interface CandidateResume {
  id: number; role_type: string; filename?: string; created_at: string; updated_at: string
}

export interface JobPosting {
  id: number; recruiter_id: number; title: string; company: string
  location?: string; description: string; required_skills: string[]
  salary_range?: string; job_type?: string; experience_level?: string
  status: 'active' | 'closed' | 'draft'; created_at: string; updated_at: string
}

export interface Match {
  id: number; candidate_id: number; job_id: number; score: number
  missing_skills: string[]; recommended_project: string; summary: string
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected'
  recruiter_notes?: string; created_at: string
  job_title?: string; job_company?: string; job_location?: string
  candidate_name?: string; candidate_email?: string; candidate_headline?: string
}

export interface Notification {
  id: number; type: string; title: string; message: string
  is_read: boolean; data?: Record<string, any>; created_at: string
}

export interface PaginatedNotifications {
  total: number; unread_count: number; page: number; size: number
  results: Notification[]
}

export interface PaginatedResponse<T> {
  total: number; page: number; size: number; results: T[]
}

export interface AutoMatchResult {
  jobs: number; candidates: number; matches_created: number
  notifications_sent: number; skipped?: boolean
}

export interface CandidateAnalytics {
  score_trend:    { date: string; score: number; filename: string }[]
  skill_gaps:     { skill: string; count: number }[]
  improvement:    number
  total_analyses: number
  avg_score:      number
  best_score:     number
  match_stats:    Record<string, number>
}

export interface RecruiterAnalytics {
  total_jobs: number; active_jobs: number
  total_candidates: number; avg_score: number
  funnel: Record<string, number>
  job_stats: {
    job_id: number; title: string; status: string
    applications: number; avg_score: number
    shortlisted: number; shortlist_rate: number
  }[]
}

export interface AdminStats {
  users: { total: number; candidates: number; recruiters: number; new_last_30d: number }
  jobs: { total: number; active: number }
  matches: { total: number; avg_score: number }
  analyses: number
}

export interface AdminUser {
  id: number; email: string; full_name: string
  role: string; is_active: boolean; is_verified: boolean; created_at: string
}

export interface AdminJob {
  id: number; recruiter_id: number; title: string
  company: string; status: string; created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getErrorMessage(err: any): string {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg ?? 'Validation error').join(', ')
  if (typeof detail === 'string') return detail
  if (err?.message) return err.message
  return 'Something went wrong. Please try again.'
}

// ── API clients ────────────────────────────────────────────────────────────────

export const authApi = {
  register:       (data: any) => api.post('/auth/register', data),
  login:          (data: any) => api.post<TokenResponse>('/auth/login', data),
  me:             () => api.get<User>('/auth/me'),
  changePassword: (data: any) => api.put('/auth/me/password', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }),
  verifyEmail:    (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
}

export const candidateApi = {
  getProfile:    () => api.get<CandidateProfile>('/candidates/me'),
  updateProfile: (data: any) => api.put<CandidateProfile>('/candidates/me', data),
  getHistory:    (page = 1, size = 10) => api.get<PaginatedResponse<AnalysisSummary>>(`/candidates/me/history?page=${page}&size=${size}`),
  getAnalysis:   (id: number) => api.get<AnalysisSummary>(`/candidates/me/history/${id}`),
  listResumes:   () => api.get<CandidateResume[]>('/candidates/me/resumes'),
  roleTypes:     () => api.get<{ role_types: string[] }>('/candidates/me/resumes/role-types'),
  uploadResume:  (role_type: string, file: File) => {
    const form = new FormData()
    form.append('role_type', role_type)
    form.append('resume', file)
    return api.post<CandidateResume>('/candidates/me/resumes', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteResume:  (id: number) => api.delete(`/candidates/me/resumes/${id}`),
}

export const resumeApi = {
  score: (file: File, jobDescription: string, roleType?: string) => {
    const form = new FormData()
    form.append('resume', file)
    form.append('job_description', jobDescription)
    if (roleType) form.append('role_type', roleType)
    return api.post<ResumeScoreResponse>('/api/v1/score-resume', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const jobsApi = {
  list: (page = 1, size = 10, filters?: {
    search?: string; location?: string; job_type?: string
    experience_level?: string; salary_contains?: string
  }) => {
    const p = new URLSearchParams({ page: String(page), size: String(size) })
    if (filters?.search)           p.set('search',           filters.search)
    if (filters?.location)         p.set('location',         filters.location)
    if (filters?.job_type)         p.set('job_type',         filters.job_type)
    if (filters?.experience_level) p.set('experience_level', filters.experience_level)
    if (filters?.salary_contains)  p.set('salary_contains',  filters.salary_contains)
    return api.get<PaginatedResponse<JobPosting>>(`/jobs?${p}`)
  },
  get:          (id: number) => api.get<JobPosting>(`/jobs/${id}`),
  mine:         (page = 1, size = 10) => api.get<PaginatedResponse<JobPosting>>(`/jobs/mine?page=${page}&size=${size}`),
  create:       (data: any) => api.post<JobPosting>('/jobs', data),
  update:       (id: number, data: any) => api.put<JobPosting>(`/jobs/${id}`, data),
  close:        (id: number) => api.delete(`/jobs/${id}`),
  matchMe:      (id: number) => api.post<Match>(`/jobs/${id}/match-me`),
  getCandidates:(id: number, page = 1, size = 10) => api.get<PaginatedResponse<Match>>(`/jobs/${id}/candidates?page=${page}&size=${size}`),
  updateMatch:  (jobId: number, matchId: number, data: any) => api.put<Match>(`/jobs/${jobId}/matches/${matchId}`, data),
  myMatches:    (page = 1, size = 10) => api.get<PaginatedResponse<Match>>(`/jobs/matches/mine?page=${page}&size=${size}`),
  runAutoMatch: () => api.post<AutoMatchResult>('/jobs/auto-match'),
}

export const notificationsApi = {
  list:        (page = 1, size = 20, unread_only = false) =>
                 api.get<PaginatedNotifications>(`/notifications?page=${page}&size=${size}&unread_only=${unread_only}`),
  unreadCount: () => api.get<{ unread_count: number }>('/notifications/unread-count'),
  markRead:    (id: number) => api.put<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
}

export const analyticsApi = {
  candidate: (days = 90) => api.get<CandidateAnalytics>(`/analytics/candidate?days=${days}`),
  recruiter: () => api.get<RecruiterAnalytics>('/analytics/recruiter'),
  admin:     () => api.get<AdminStats>('/analytics/admin'),
}

export const adminApi = {
  listUsers:  (page = 1, size = 20, search = '', role = '') =>
                api.get<PaginatedResponse<AdminUser>>(`/admin/users?page=${page}&size=${size}&search=${search}&role=${role}`),
  toggleUser: (id: number, active: boolean) => api.put(`/admin/users/${id}?active=${active}`),
  listJobs:   (page = 1, size = 20) => api.get<PaginatedResponse<AdminJob>>(`/admin/jobs?page=${page}&size=${size}`),
  deleteJob:  (id: number) => api.delete(`/admin/jobs/${id}`),
  stats:      () => api.get<AdminStats>('/analytics/admin'),
}