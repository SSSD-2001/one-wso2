import { githubOAuthConfig } from "@config/apiConfig";

const STATE_KEY = "gh_oauth_state";
const CODE_KEY = "gh_pending_oauth_code";
const RESULT_KEY = "gh_connect_result";
export const GITHUB_OAUTH_STATE_EXPIRY_MS = 5 * 60 * 1000;
export const DEFAULT_GITHUB_RETURN_PATH = "/infra";

export interface GitHubOAuthStoredState {
    state: string;
    createdAt: number;
    returnPath: string;
}

export interface GitHubConnectResult {
    status: "verified" | "unverified" | "error";
    githubUserId?: string;
    githubUsername?: string;
    errorMessage?: string;
}

export function startGitHubOAuth(returnPath = DEFAULT_GITHUB_RETURN_PATH): void {
    const state = crypto.randomUUID();
    const stored: GitHubOAuthStoredState = { state, createdAt: Date.now(), returnPath };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(stored));
    const params = new URLSearchParams({
        client_id: githubOAuthConfig.clientId,
        scope: githubOAuthConfig.scopes.join(" "),
        state,
        redirect_uri: githubOAuthConfig.redirectUrl,
        prompt: "select_account",
    });
    window.location.assign(`${githubOAuthConfig.authorizeUrl}?${params.toString()}`);
}

export function readStoredOAuthState(): GitHubOAuthStoredState | null {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as GitHubOAuthStoredState;
    } catch {
        return null;
    }
}

export function clearOAuthAttempt(): void {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(CODE_KEY);
}

/** Returns an error result when state is missing, expired, or mismatched. Does not call the backend. */
export function acceptOAuthCallback(
    code: string | null,
    urlState: string | null,
    now = Date.now(),
): { ok: true; returnPath: string } | { ok: false; returnPath: string; result: GitHubConnectResult } {
    const stored = readStoredOAuthState();
    const returnPath = stored?.returnPath || DEFAULT_GITHUB_RETURN_PATH;
    const fail = (errorMessage: string) => {
        clearOAuthAttempt();
        const result: GitHubConnectResult = { status: "error", errorMessage };
        sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
        return { ok: false as const, returnPath, result };
    };
    if (!code || !urlState || !stored) {
        if (sessionStorage.getItem(CODE_KEY)) {
          return { ok: true, returnPath: DEFAULT_GITHUB_RETURN_PATH };
        }
        return fail("Security validation failed: authentication state missing. Please try again.");
    }
    if (now - stored.createdAt > GITHUB_OAUTH_STATE_EXPIRY_MS) {
        return fail("Session expired: the connection request took too long. Please try again.");
    }
    if (urlState !== stored.state) {
        return fail("Security validation failed: authentication state mismatch. Please try again.");
    }
    sessionStorage.setItem(CODE_KEY, code);
    sessionStorage.removeItem(STATE_KEY);
    return { ok: true, returnPath };
}

export function consumePendingOAuthCode(): string | null {
  const code = sessionStorage.getItem(CODE_KEY);
  if (code) sessionStorage.removeItem(CODE_KEY);
  return code;
}

export function consumeStoredGitHubConnectResult(): GitHubConnectResult | null {
  const raw = sessionStorage.getItem(RESULT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(RESULT_KEY);
  try {
    return JSON.parse(raw) as GitHubConnectResult;
  } catch {
    return null;
  }
}

export function resolveGitHubConnection(input: {
  verified?: GitHubConnectResult | null;
  jwtGithubUserId?: string | null;
  githubUsername?: string | null;
}): { isConnected: boolean; githubUsername?: string } {
  const justVerified = input.verified?.status === "verified";
  const isConnected = justVerified || Boolean(input.jwtGithubUserId);
  const githubUsername =
    (justVerified ? input.verified?.githubUsername : undefined) ??
    input.githubUsername ??
    undefined;
  return { isConnected, githubUsername: githubUsername || undefined };
}