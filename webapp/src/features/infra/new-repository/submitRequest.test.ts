import { describe, expect, it } from "vitest";
import { emptyAccessStep } from "./accessStep";
import { emptyRepositoryStep } from "./repositoryStep";
import { toRepositoryRequestCreate } from "./submitRequest";

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