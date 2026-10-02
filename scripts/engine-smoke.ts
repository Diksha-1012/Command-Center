import { seedData } from "@/data/seed";
import { buildDependencyGraph } from "@/lib/dependencyEngine";
import { analyzeRisk } from "@/lib/riskEngine";
import { analyzeImpact } from "@/lib/impactAnalyzer";
import { simulateChange, applyChange } from "@/lib/changeSimulator";
import { teamLoadMap, rebalanceSuggestions } from "@/lib/workloadAnalyzer";
import { coverageGaps, recommendReplacement } from "@/lib/recommendationEngine";
import { dailyBrief } from "@/lib/brief";
import { answerQuestion } from "@/lib/copilot";

const line = (s: string) => console.log(`\n=== ${s} ===`);

const graph = buildDependencyGraph(seedData);
line("GRAPH");
console.log("nodes", Object.keys(graph.nodes).length, "edges", graph.edges.length);
const kinds = new Set(graph.edges.map((e) => e.kind));
console.log("edge kinds", [...kinds].join(", "));

const risk = analyzeRisk(seedData);
line("RISK");
console.log("findings", risk.findings.length, "counts", JSON.stringify(risk.counts));
console.log("sample:", risk.findings.slice(0, 3).map((f) => `${f.rule}:${f.level}`).join(" | "));

line("IMPACT — Main Auditorium venue change");
const impact = analyzeImpact(seedData, { kind: "venue", id: "v-main", label: "Main Auditorium" }, "Main Auditorium → Innovation Hall", { graph, risk });
console.log("score", impact.impactScore, impact.impactLevel, "total", impact.totalAffected);
console.log("direct", impact.direct.length, "indirect", impact.indirect.length, "potential", impact.potential.length);
console.log("byKind", impact.byKind.map((k) => `${k.kind}:${k.count}`).join(", "));

line("SIMULATE venue change for Hackathon Final Pitch");
const sim = simulateChange(seedData, { kind: "change_venue", subjectId: "s-hack", subjectKind: "session", subjectLabel: "Hackathon Final Pitch", fromValue: "Main Auditorium", toValue: "Innovation Hall", toId: "v-innov" });
console.log("headline", sim.headline);
console.log("affected", sim.analysis.totalAffected, "score", sim.analysis.impactScore);
console.log("risks", sim.risks.length, sim.risks.map((r) => r.rule).join(","));
console.log("actions", sim.actions.length, sim.actions.map((a) => a.kind).join(","));
console.log("before rows", sim.before.length, "after rows", sim.after.length);
console.log("after[venue]", sim.after.find((r) => r.label === "Venue")?.after);

line("SIMULATE remove volunteer v13");
const sim2 = simulateChange(seedData, { kind: "remove_volunteer", subjectId: "v13", subjectKind: "volunteer", subjectLabel: "Vivaan Rao", fromValue: "assigned", toValue: "removed" });
console.log("affected", sim2.analysis.totalAffected, "risks", sim2.risks.length, "actions", sim2.actions.length);
console.log("actions:", sim2.actions.map((a) => a.title).join(" | "));

line("SIMULATE remove resource r6");
const sim3 = simulateChange(seedData, { kind: "remove_resource", subjectId: "r6", subjectKind: "resource", subjectLabel: "Extension Boards", fromValue: "9 available", toValue: "out of service" });
console.log("affected", sim3.analysis.totalAffected, "risks", sim3.risks.map((r) => r.rule).join(","));

line("APPLY venue change (pure)");
const applied = applyChange(seedData, sim.request);
console.log("session venue now", applied.sessions.find((s) => s.id === "s-hack")?.venueId, "(expect v-innov)");
console.log("original untouched", seedData.sessions.find((s) => s.id === "s-hack")?.venueId, "(expect v-main)");
console.log("incidents", applied.incidents.length, "activity", applied.activity.length);

line("WORKLOAD");
console.log(teamLoadMap(seedData).map((t) => `${t.name}:${t.load}${t.overloaded ? "!" : ""}`).join(" "));
console.log("rebalance moves", rebalanceSuggestions(seedData).length);

line("RECOMMENDATIONS");
const rec = recommendReplacement(seedData, "v13");
console.log("replace Vivaan ->", rec?.best?.name, rec?.best?.total, "alts", rec?.alternatives.map((a) => `${a.name}:${a.total}`).join(", "));
console.log("coverage gaps", coverageGaps(seedData).length);

line("BRIEF");
const brief = dailyBrief(seedData);
console.log(brief.greeting, "items", brief.items.length, "actions", brief.actions.length);

line("COPILOT");
for (const q of ["What needs attention today?", "Who is overloaded?", "Which resources are currently conflicting?", "What sessions depend on the Main Auditorium?", "Which volunteers can replace Vivaan Rao?", "What happens if the auditorium changes?", "Tell me a joke"]) {
  const a = answerQuestion(q, seedData);
  console.log(`• ${q}\n  [${a.source} ${a.confidence}%] ${a.content.slice(0, 120).replace(/\n/g, " ")}`);
}
