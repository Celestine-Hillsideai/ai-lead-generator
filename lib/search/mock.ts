import type { DecisionMakerSearchQuery, DecisionMakerSearchResult, SearchProvider } from "./types";

/** Deterministic mock, per docs/spec.md §29 (MOCK_SEARCH=true). */
export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async findDecisionMakers(query: DecisionMakerSearchQuery): Promise<DecisionMakerSearchResult[]> {
    const role = query.targetRoles[0] ?? "CEO";
    return [
      {
        fullName: "Jane Doe",
        title: role,
        email: null,
        emailStatus: "unknown",
        sourceUrl: null,
        confidence: 0.5,
      },
    ];
  }
}
