import { useEffect } from "react";
import { useNavigate } from "react-router";
import { acceptOAuthCallback } from "../github/githubOAuth";

export default function InfraGitHubCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = acceptOAuthCallback(params.get("code"), params.get("state"));
    navigate(outcome.returnPath, { replace: true });
  }, [navigate]);

  return null;
}