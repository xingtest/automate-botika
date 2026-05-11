const ManualTriggerNode = require('./manual-trigger-node');
const ValidateTestCaseSchemaNode = require('./validate-test-case-schema-node');
const ConversationScenarioNode = require('./conversation-scenario-node');
const ResponseCaptureQualityNode = require('./response-capture-quality-node');
const RetryRecoveryNode = require('./retry-recovery-node');
const RuleAssertionNode = require('./rule-assertion-node');
const SafetyPolicyCheckNode = require('./safety-policy-check-node');
const HallucinationDetectorNode = require('./hallucination-detector-node');
const RubricBuilderNode = require('./rubric-builder-node');
const MultiJudgeEvaluationNode = require('./multi-judge-evaluation-node');
const JudgePromptVersionNode = require('./judge-prompt-version-node');
const BaselineComparisonNode = require('./baseline-comparison-node');
const FlakinessDetectorNode = require('./flakiness-detector-node');
const KnowledgeCoverageNode = require('./knowledge-coverage-node');
const FailureClusteringNode = require('./failure-clustering-node');
const RootCauseSuggestionNode = require('./root-cause-suggestion-node');
const ArtifactCollectorNode = require('./artifact-collector-node');
const CIGateNode = require('./ci-gate-node');
const TestDataGeneratorNode = require('./test-data-generator-node');
const TestCaseExpanderNode = require('./test-case-expander-node');
const PromptInjectionTestNode = require('./prompt-injection-test-node');

function makeContext(input) {
  return {
    execution_id: 'smoke-test',
    current_node_id: 'smoke-node',
    user_id: 1,
    connections: [],
    getInput() { return input; },
    getNodeOutput() { return null; }
  };
}

async function runNode(NodeClass, input, config = {}) {
  const node = new NodeClass();
  return node.execute(makeContext(input), config, { id: 'smoke-node', type: node.schema.type, config });
}

async function main() {
  const sample = {
    results: [
      {
        no: 1,
        title: 'Kontak Botika',
        category: 'Kontak',
        question: 'Bagaimana menghubungi Botika?',
        response_kb: 'Botika dapat dihubungi melalui email support@botika.online.',
        response_llm: 'Botika dapat dihubungi melalui email support@botika.online.',
        must_include: ['support@botika.online'],
        must_not_include: ['password']
      }
    ],
    knowledge_base_text: 'Botika dapat dihubungi melalui email support@botika.online.',
    required_topics: ['Kontak']
  };

  const trigger = await runNode(ManualTriggerNode, null, { initialData: sample });
  let output = await runNode(ValidateTestCaseSchemaNode, trigger, { required_fields: 'question,response_kb,response_llm', fail_on_invalid: true });
  await runNode(TestDataGeneratorNode, trigger, { max_cases: 1 });
  await runNode(TestCaseExpanderNode, trigger, { modes: 'casual,short' });
  await runNode(PromptInjectionTestNode, trigger, { append_to_results: false });
  output = await runNode(ConversationScenarioNode, output);
  output = await runNode(ResponseCaptureQualityNode, output, { min_length: 8 });
  output = await runNode(RetryRecoveryNode, output, { max_retries: 2 });
  output = await runNode(RuleAssertionNode, output);
  output = await runNode(SafetyPolicyCheckNode, output);
  output = await runNode(HallucinationDetectorNode, output, { claim_similarity_threshold: 0.05 });
  output = await runNode(RubricBuilderNode, output);
  output = await runNode(MultiJudgeEvaluationNode, output, { threshold: 0.7 });
  output = await runNode(JudgePromptVersionNode, output, { version: 'smoke-v1' });
  output = await runNode(BaselineComparisonNode, output);
  output = await runNode(FlakinessDetectorNode, output);
  output = await runNode(KnowledgeCoverageNode, output, { required_topics: 'Kontak' });
  output = await runNode(FailureClusteringNode, output);
  output = await runNode(RootCauseSuggestionNode, output);
  output = await runNode(ArtifactCollectorNode, output);
  output = await runNode(CIGateNode, output, { minimum_average_score: 0.7, allow_flaky: true });

  if (!output.ci_gate || output.ci_gate.status !== 'PASS') {
    throw new Error(`Expected CI gate PASS, got ${JSON.stringify(output.ci_gate)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    total_items: output.total_items,
    ci_gate: output.ci_gate
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
