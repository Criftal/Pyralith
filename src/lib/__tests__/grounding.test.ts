import { describe, expect, it } from "vitest";
import { groundAnswer, NO_COUNTER, NO_EVIDENCE, splitSentences } from "../../../api/_lib/grounding";

const allowed = new Set(["f_0014", "f_0053", "c_fm2"]);

describe("live-mode grounding", () => {
  it("keeps sentences that cite provided records", () => {
    const g = groundAnswer("Flames survive at 14% O2 in low flow [f_0014]. Lunar gravity may be worst [f_0053, c_fm2].", allowed);
    expect(g.sentences.map((s) => s.citations)).toEqual([["f_0014"], ["f_0053", "c_fm2"]]);
    expect(g.stripped).toBe(0);
  });

  it("strips uncited sentences and sentences citing records it was not given", () => {
    const g = groundAnswer("Fire is dangerous. Mars is worse [f_9999]. Low flow sustains flames [f_0014].", allowed);
    expect(g.sentences).toHaveLength(1);
    expect(g.stripped).toBe(2);
    expect(g.answer).toBe("Low flow sustains flames [f_0014].");
  });

  it("falls back to the no-evidence message when nothing survives", () => {
    expect(groundAnswer("Everything burns on the Moon.", allowed).answer).toBe(NO_EVIDENCE);
    expect(groundAnswer("Nothing argues against it.", allowed, "redteam").answer).toBe(NO_COUNTER);
    expect(groundAnswer(NO_EVIDENCE, allowed).sentences).toHaveLength(1);
  });

  it("re-attaches a citation that was split into its own fragment", () => {
    expect(splitSentences("Flames survive at low flow. [f_0014].")).toEqual(["Flames survive at low flow. [f_0014]."]);
  });
});
