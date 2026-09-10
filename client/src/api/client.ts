import type { AuthSuccessResponse, AuthUser, RefreshResponse } from '../types/auth';
import type {
  ApplicationListItem,
  ApplicationNote,
  ApplicationsListResponse,
  ApplicationStatus,
  CreateApplicationInput,
  CreateApplicationNoteInput,
  CreateInterviewInput,
  CreateLearningGoalInput,
  CvOptimizerResult,
  Interview,
  LearningGoal,
  OptimizeCvInput,
  SkillsGapResponse,
  UpdateApplicationInput,
  UpdateInterviewInput,
  UpdateLearningGoalInput,
} from '../types/application';
import type { CvAnalysisResult, CvRecord } from '../types/cv';
import type {
  JobListItem,
  JobsListResponse,
  JobSourceInfo,
  JobStats,
  ManualJobInput,
  SyncSummary,
} from '../types/job';
import type { MatchResult } from '../types/matching';
import type { PreferencesData, ProfileBundle, UserProfileData } from '../types/profile';
import type {
  SavedJobsListResponse,
  SavedStatusResponse,
} from '../types/saved';
import type {
  MarkAllReadResponse,
  NotificationsResponse,
  UnreadCountResponse,
} from '../types/notification';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  database: 'connected' | 'not_configured' | 'unreachable';
  timestamp: string;
}

// The access token lives in memory only (never localStorage) to keep the XSS
// blast radius small. Persistence across reloads is handled by the httpOnly
// refresh cookie via POST /auth/refresh.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      message = data.error;
    }
  } catch {
    // Response body was not JSON — keep the generic message.
  }
  return new ApiError(response.status, message);
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRefresh = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...options.headers,
  };
  // The browser sets the multipart boundary itself — never force
  // Content-Type when uploading a FormData body.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Access token expired: try one silent refresh, then replay the request.
  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Silent session bootstrap/refresh using the httpOnly cookie. */
export async function refreshSession(): Promise<boolean> {
  try {
    const data = await request<RefreshResponse>('/auth/refresh', { method: 'POST' }, false);
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' }, false);
  } finally {
    setAccessToken(null);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/auth/me');
  return data.user;
}

export async function fetchProfileBundle(): Promise<ProfileBundle> {
  return request<ProfileBundle>('/profile');
}

export async function updateProfile(
  input: Partial<UserProfileData>,
): Promise<ProfileBundle> {
  return request<ProfileBundle>('/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function updatePreferences(
  input: Partial<PreferencesData>,
): Promise<ProfileBundle> {
  return request<ProfileBundle>('/profile/preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ---------------------------- CV (Phase 3) ----------------------------

export async function uploadCv(file: File): Promise<CvRecord> {
  const body = new FormData();
  body.append('file', file);
  return request<CvRecord>('/cv', { method: 'POST', body });
}

export async function listCvs(): Promise<CvRecord[]> {
  return request<CvRecord[]>('/cv');
}

export async function analyzeCv(cvId: string): Promise<CvAnalysisResult> {
  return request<CvAnalysisResult>(`/cv/${cvId}/analyze`, { method: 'POST' });
}

export async function setPrimaryCv(cvId: string): Promise<CvRecord> {
  return request<CvRecord>(`/cv/${cvId}/primary`, { method: 'PATCH' });
}

export async function deleteCv(cvId: string): Promise<void> {
  return request<void>(`/cv/${cvId}`, { method: 'DELETE' });
}

// ---------------------------- Jobs (Phase 4) ----------------------------

export async function listJobs(params: {
  q?: string;
  workMode?: string;
  location?: string;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<JobsListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.workMode) query.set('workMode', params.workMode);
  if (params.location) query.set('location', params.location);
  if (params.source) query.set('source', params.source);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<JobsListResponse>(`/jobs${qs ? `?${qs}` : ''}`);
}

export async function getJob(jobId: string): Promise<JobListItem> {
  return request<JobListItem>(`/jobs/${jobId}`);
}

export async function listJobSources(): Promise<JobSourceInfo[]> {
  return request<JobSourceInfo[]>('/jobs/sources');
}

export async function getJobStats(): Promise<JobStats> {
  return request<JobStats>('/jobs/stats');
}

export async function syncJobs(): Promise<SyncSummary> {
  return request<SyncSummary>('/jobs/sync', { method: 'POST' });
}

export async function addManualJob(input: ManualJobInput): Promise<{ id: string }> {
  return request<{ id: string }>('/jobs/manual', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------------------------- Matching (Phase 5) ----------------------------

export async function getMatch(jobId: string): Promise<MatchResult> {
  return request<MatchResult>(`/matching/${jobId}`);
}

export async function getMatches(limit = 50): Promise<{ matches: MatchResult[]; total: number }> {
  return request<{ matches: MatchResult[]; total: number }>(`/matching?limit=${limit}`);
}

// ---------------------------- Saved jobs (Phase 8, Step 1) ----------------------------

export async function listSavedJobs(): Promise<SavedJobsListResponse> {
  return request<SavedJobsListResponse>('/saved');
}

export async function saveJob(jobId: string): Promise<SavedStatusResponse> {
  return request<SavedStatusResponse>(`/saved/${encodeURIComponent(jobId)}`, {
    method: 'POST',
  });
}

export async function unsaveJob(jobId: string): Promise<void> {
  return request<void>(`/saved/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

export async function isJobSaved(jobId: string): Promise<SavedStatusResponse> {
  return request<SavedStatusResponse>(`/saved/${encodeURIComponent(jobId)}`);
}

// ------------------------- Applications (Phase 8, Step 2) -------------------------

export async function listApplications(): Promise<ApplicationsListResponse> {
  return request<ApplicationsListResponse>('/applications');
}

export async function getApplication(id: string): Promise<ApplicationListItem> {
  return request<ApplicationListItem>(`/applications/${encodeURIComponent(id)}`);
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<ApplicationListItem> {
  return request<ApplicationListItem>('/applications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput,
): Promise<ApplicationListItem> {
  return request<ApplicationListItem>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<ApplicationListItem> {
  return request<ApplicationListItem>(
    `/applications/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ------------------------- Application notes (Phase 8, Step 3) -------------------------

export async function listApplicationNotes(applicationId: string): Promise<ApplicationNote[]> {
  return request<ApplicationNote[]>(
    `/applications/${encodeURIComponent(applicationId)}/notes`,
  );
}

export async function addApplicationNote(
  applicationId: string,
  input: CreateApplicationNoteInput,
): Promise<ApplicationNote> {
  return request<ApplicationNote>(
    `/applications/${encodeURIComponent(applicationId)}/notes`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteApplicationNote(
  applicationId: string,
  noteId: string,
): Promise<void> {
  return request<void>(
    `/applications/${encodeURIComponent(applicationId)}/notes/${encodeURIComponent(noteId)}`,
    { method: 'DELETE' },
  );
}

// ----------------------- Application interviews (Phase 8, Step 3) -----------------------

export async function listApplicationInterviews(applicationId: string): Promise<Interview[]> {
  return request<Interview[]>(
    `/applications/${encodeURIComponent(applicationId)}/interviews`,
  );
}

export async function createApplicationInterview(
  applicationId: string,
  input: CreateInterviewInput,
): Promise<Interview> {
  return request<Interview>(
    `/applications/${encodeURIComponent(applicationId)}/interviews`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function updateApplicationInterview(
  applicationId: string,
  interviewId: string,
  input: UpdateInterviewInput,
): Promise<Interview> {
  return request<Interview>(
    `/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteApplicationInterview(
  applicationId: string,
  interviewId: string,
): Promise<void> {
  return request<void>(
    `/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}`,
    { method: 'DELETE' },
  );
}

// ------------------------- Skills gap (Phase 9) -------------------------

export async function getSkillsGap(): Promise<SkillsGapResponse> {
  return request<SkillsGapResponse>('/skills/gap');
}

export async function listLearningGoals(): Promise<LearningGoal[]> {
  return request<LearningGoal[]>('/skills/learning-goals');
}

export async function createLearningGoal(
  input: CreateLearningGoalInput,
): Promise<LearningGoal> {
  return request<LearningGoal>('/skills/learning-goals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLearningGoal(
  id: string,
  input: UpdateLearningGoalInput,
): Promise<LearningGoal> {
  return request<LearningGoal>(`/skills/learning-goals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteLearningGoal(id: string): Promise<void> {
  return request<void>(`/skills/learning-goals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ------------------------- CV Optimizer (Phase 9) -------------------------

export async function optimizeCv(cvId: string, jobId: string): Promise<CvOptimizerResult> {
  return request<CvOptimizerResult>(
    `/cv/${encodeURIComponent(cvId)}/optimize`,
    {
      method: 'POST',
      body: JSON.stringify({ jobId } satisfies OptimizeCvInput),
    },
  );
}

// ------------------------- Notifications (Phase 10) -------------------------

export async function listNotifications(): Promise<NotificationsResponse> {
  return request<NotificationsResponse>('/notifications');
}

export async function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return request<UnreadCountResponse>('/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<void> {
  return request<void>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  return request<MarkAllReadResponse>('/notifications/read-all', {
    method: 'PATCH',
  });
}

export async function deleteNotification(id: string): Promise<void> {
  return request<void>(`/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
