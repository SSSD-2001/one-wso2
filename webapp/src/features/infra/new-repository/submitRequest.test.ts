import { describe, expect, it } from "vitest";
import { emptyAccessStep } from "./accessStep";
import { emptyRepositoryStep } from "./repositoryStep";
import { toRepositoryRequestCreate, toRepositoryRequestUpdate } from "./submitRequest";
import type { InfraRepositoryRequest } from "../api/infraTypes";

const general = {
  email: "a@wso2.com",
  leadEmail: "lead@wso2.com",
  requirement: "Need a repo",
  ccList: ["b@wso2.com"],
};

describe("toRepositoryRequestCreate", () => {
  it("prefixes a bare website and fills the skipped CI/CD fields", () => {
    const body = toRepositoryRequestCreate(
      general,
      { ...emptyRepositoryStep, organizationId: 4, repoName: "demo", description: "A repo", topics: ["api"], websiteUrl: "wso2.com", prProtection: "Default" },
      { ...emptyAccessStep, teams: ["wso2-all"] },
    );
    expect(body.websiteUrl).toBe("https://wso2.com");
    expect(body.cicdRequirement).toBe("Not Applicable");
    expect(body.jenkinsJobType).toBe("N/A");
    expect(body.disableTriageReason).toBe("N/A");
  });

  it("keeps a private triage reason", () => {
    const body = toRepositoryRequestCreate(
      general,
      { ...emptyRepositoryStep, organizationId: 4, repoName: "demo", repoType: "Private", description: "A repo", topics: ["api"], prProtection: "Default" },
      { ...emptyAccessStep, repoType: "Private", teams: ["wso2-all"], enableTriageWso2All: "No", disableTriageReason: "Internal only" },
    );
    expect(body.enableTriageWso2All).toBe("No");
    expect(body.disableTriageReason).toBe("Internal only");
  });
});

const original: InfraRepositoryRequest = {
  id: 7,
  email: "a@wso2.com",
  leadEmail: "lead@wso2.com",
  requirement: "Need a repo",
  ccList: "b@wso2.com",
  repoName: "demo",
  organizationId: 4,
  organizationName: "wso2",
  repoType: "Public",
  description: "A repo",
  enableIssues: "No",
  websiteUrl: null,
  topics: "api",
  prProtection: "Default",
  teams: "wso2-all",
  enableTriageWso2All: "Yes",
  enableTriageWso2AllInterns: "Yes",
  disableTriageReason: "N/A",
  state: "Pending",
  timestamp: "2026-01-01",
  updatedAt: null,
};

describe("toRepositoryRequestUpdate", () => {
  const repository = {
    ...emptyRepositoryStep,
    organizationId: 4,
    organizationName: "wso2",
    repoName: "demo",
    description: "A repo",
    topics: ["api"],
    prProtection: "Default",
  };
  const access = { ...emptyAccessStep, teams: ["wso2-all"] };

  it("sends the pending state and only the changed fields", () => {
    const body = toRepositoryRequestUpdate(
      original,
      { ...general, requirement: "A clearer need" },
      repository,
      access,
    );
    expect(body).toEqual({ id: 7, state: "Pending", requirement: "A clearer need" });
  });

  it("does not produce an update when nothing changed", () => {
    expect(toRepositoryRequestUpdate(original, general, repository, access)).toBeNull();
  });
});