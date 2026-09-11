/**
 * Section 9: "Store: model version, input dataset, execution time,
 * assumptions, confidence/uncertainty." This constant is what gets
 * recorded as `modelVersion` on every ScenarioRun row — bump it whenever
 * a scenario function's methodology changes, so a stored run always
 * records which version of the math produced it.
 */
export const SCENARIO_MODEL_VERSION = "scenario-model-v1";
