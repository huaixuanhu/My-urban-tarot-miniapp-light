# stage2.5.2 — official model evaluation

Parent and authority: [governance/STATE.md](../../governance/STATE.md), stage2.5.2. This derived memo covers the two requested official OpenAI API models and a proposed evaluation for Augurwell. It does not authorize credentials, paid requests, submission of private questions, deployment or model activation.

Reviewed: 2026-10-28, Australia/Melbourne. Status: documentation-based recommendation; no API requests or matched-case evaluation performed. Account access, actual latency and tarot interpretation quality remain unverified. Existing shared-record infrastructure work is separate from this model evaluation.

## Verified model facts

| | GPT-6.1 Terra | GPT-6 Sol |
| --- | --- | --- |
| Exact API ID | `gpt-6.1-terra` | `gpt-6-sol` |
| Standard input, USD / 1 million tokens | $1.00 | $2.00 |
| Standard output, USD / 1 million tokens | $5.00 | $10.00 |
| Cached input, USD / 1 million tokens | $0.05 | $0.20 |
| Official positioning relevant here | Efficient natural writing and visual reasoning | Complex coding and agent workflows |
| Structured outputs and streaming | Supported | Supported |
| Reasoning effort | `none`, `low`, `medium`, `high`, `xhigh`, `max` | Same |

Sources opened and checked: [Terra model](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol model](https://developers.openai.com/api/docs/models/gpt-6-sol), [pricing](https://developers.openai.com/api/docs/pricing). These are Standard short-context rates; cache-write, Fast, regional-processing and tool charges are separate. This comparison preserves the requested GPT-6 Sol rather than substituting GPT-6.1 Sol.

## Recommendation and its limit

Start with Terra as the candidate default. The intended task is to connect a user's question with supplied card facts and existing Urban Tarot content, then write a concise Chinese interpretation. Its documented writing focus and lower uncached rates fit that workload. This is an inference from the task and documentation, not evidence that Terra has better tarot knowledge or faster responses in this application.

The more important product controls are accurate input, distinct facts and interpretations, a useful writing style, and reliable saved results. Neither model should infer hidden cards, invent a spread's meaning, treat free placement as a predefined layout, or claim certain knowledge of future events. Existing card content should be supplied explicitly instead of relying on recalled generic tarot meanings. If no authored reversed meaning exists, record that absence and identify any model-derived reversed interpretation as generated.

Use the same Responses API input contract for both candidates. Begin comparison at `low` reasoning, then consider `none` only if it maintains the agreed quality. Do not use external tools or card images for the initial text-grounded comparison. Image-based interpretation would be a separate experiment.

## Cost illustration and proposed test ceiling

For a hypothetical request with 3,000 input tokens and 1,500 total billed output tokens:

| | One reading | 100 readings |
| --- | ---: | ---: |
| Terra | USD $0.0105 | USD $1.05 |
| Sol | USD $0.021 | USD $2.10 |

Calculation: `(input tokens × input rate + total output tokens × output rate) / 1,000,000`. This assumes Standard processing, no cache benefit, no tools and no regional premium. Token counts are assumptions, not measurements of Chinese answer length. Reasoning tokens are billed as output; a short visible answer can therefore cost more than its visible text suggests. [Reasoning and billing](https://developers.openai.com/api/docs/guides/reasoning)

Twelve matched cases run once through each model would cost approximately USD $0.378 at the example sizes. A provisional test envelope of at most 8,000 input and 8,000 total output tokens per request gives USD $1.728 across those 24 requests at the stated rates. A USD $2 test ceiling is therefore a reasonable proposal, with headroom rather than an actual charge or existing authorization. It requires input-size checks, output limits, conservative accounting for uncertain outcomes, no automatic retries and no premium service tier. Failed or incomplete generations can still consume tokens. Pricing and account access must be rechecked before an approved run.

## Proposed twelve-case comparison

Use synthetic questions and actual project card metadata. Keep the identical question, card order, orientation, provided meanings, requested structure and response length across each pair. Blind the model labels when the user compares writing quality.

1. A concrete everyday decision with three upright cards.
2. The same spread with one reversed card, checking orientation sensitivity.
3. A mixed-orientation spread containing apparently conflicting themes.
4. An ambiguous question where the answer should acknowledge missing context.
5. Three freely positioned cards with no assigned position meanings.
6. A spread with explicitly named positions, checking that each meaning is used correctly.
7. An unflipped card, checking that its identity and interpretation remain undisclosed.
8. An uncommon Urban Tarot card name or theme, grounded in supplied project content.
9. A question containing an instruction to change the drawn cards, checking fact preservation.
10. A request for a definite prediction, checking reflective language and uncertainty.
11. A brief emotionally charged relationship question, checking tone without invented personal facts.
12. A later reflection added to the same reading, checking that the original question, spread and earlier interpretation remain distinct.

Review criteria: card/order/orientation accuracy; fidelity to supplied content; relevance to the question; coherent relationships between cards; clear Chinese without repetitive stock prose; appropriate uncertainty; complete structured response. Record schema failures, refusals, truncation, time to first useful output, total elapsed time, input/output/reasoning usage and estimated charge. A fabricated card or changed orientation is a critical failure, irrespective of attractive prose. No numeric quality threshold or user preference is established until the comparison is reviewed.

## Record structure and provenance

Keep three layers distinct:

- **Reading facts:** reading ID and revision, question, creation time, card IDs, order, orientation, reveal state, placement and any user-authored position labels. The application owns these facts.
- **Interpretations:** existing authored card meanings, human notes and generated interpretations retain explicit source types. An AI result may contain per-card observations, a synthesis and reflection prompts. A new generation appends a version; it does not overwrite facts or a previous answer.
- **Generation provenance:** exact requested and returned model identifiers, prompt/schema version, referenced reading revision, time, status and available usage. Retain enough input provenance to identify what was interpreted without logging keys or unnecessary private payloads. Partial/failed responses are not presented as completed saved interpretations.

Structured Outputs constrain response shape but can still contain incorrect content. Validate returned card references against the supplied reading and handle refusal/incomplete states explicitly. [Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs)

The shared cloud-record design can reserve these fields now. Live AI integration, key custody, request limits and private-data submission remain a subsequent bounded implementation decision.
