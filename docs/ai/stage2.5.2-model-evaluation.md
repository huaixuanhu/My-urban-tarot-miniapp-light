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

The more important product controls are accurate input, distinct facts and interpretations, a useful writing style, and reliable saved results. Neither model should infer hidden cards, invent a spread's meaning, treat free placement as a predefined layout, or claim certain knowledge of future events. Existing card content should be supplied explicitly instead of relying on recalled generic tarot meanings. Inspection of [the project deck data](../../client/src/data/tarotData.json) confirms that none of its 78 cards has an authored `reversedInterpretation`; record that absence and identify any model-derived reversed interpretation as generated.

Use the same Responses API input contract for both candidates. Begin comparison at `low` reasoning, then consider `none` only if it maintains the agreed quality. Do not use external tools or card images for the initial text-grounded comparison. Image-based interpretation would be a separate experiment.

## Cost illustration and proposed test ceiling

For a hypothetical request with 3,000 input tokens and 1,500 total billed output tokens:

| | One reading | 100 readings |
| --- | ---: | ---: |
| Terra | USD $0.0105 | USD $1.05 |
| Sol | USD $0.021 | USD $2.10 |

Calculation: `(input tokens × input rate + total output tokens × output rate) / 1,000,000`. This assumes Standard processing, no cache benefit, no tools and no regional premium. Token counts are assumptions, not measurements of Chinese answer length. Reasoning tokens are billed as output; a short visible answer can therefore cost more than its visible text suggests. [Reasoning and billing](https://developers.openai.com/api/docs/guides/reasoning)

The proposed first pilot is six Terra requests only: approximately USD $0.063 at the example sizes. Cap each request at 4,000 input tokens and 3,000 total output tokens, including reasoning. At Standard uncached rates, the six-request maximum is USD $0.114. Even if all input is billed as 30-minute cache writes, the corresponding amount is USD $0.120; at 12-hour write rates it is USD $0.150. These figures exclude tools, premium processing, regional premiums, tax and unrelated hosting/storage charges.

A **USD $0.20 model-token budget** is proposed for this pilot, not authorized or incurred. Before an approved run, verify account access and rates, count input tokens, enforce the output cap, reserve the maximum per attempt and stop rather than automatically retry a failed, incomplete or uncertain request. An incomplete answer is a test outcome, not permission for another call. No private records are submitted. Model selection, credential access and these paid requests remain pending.

## Proposed six-case Terra-first pilot

Use one fixed prompt with `gpt-6.1-terra`, `low` reasoning, synthetic questions and the actual metadata for only the selected cards. All cards are revealed and upright unless explicitly stated. No position meaning is assigned unless provided below. Do not submit the full deck, images, private saved readings or room assets.

| Case | Synthetic question | Source cards and purpose |
| --- | --- | --- |
| 1 | 我一直想开始一个小创作项目，但担心坚持不下去，可以关注什么？ | The Fool (`major-00`), The Mage (`major-01`), Eight of Disks (`disks-08`): practical relevance and connected interpretation. |
| 2 | Same question as case 1. | Same cards; only The Mage is reversed. Check orientation sensitivity while keeping the facts intact and marking the generated reversal extension. |
| 3 | 两个兴趣都想继续，怎么找到兼顾的方法？ | Art (`major-14`), The Hanged Man (`major-12`), The Hermit (`major-09`), with respective labels “可以整合／需要松开／下一步”. Check user-authored labels and Urban Tarot terminology. |
| 4 | 最近为了完成计划，把自己逼得很紧，怎么调整？ | Nine of Swords (`swords-09`), Four of Swords (`swords-04`), The Sun (`major-19`). The source's Nine of Swords concerns troubling consequences of noble goals; check that generic recalled meanings do not replace this supplied content. |
| 5 | 我和朋友最近交流少了，我可以怎样主动一点？ | The Moon (`major-18`), Two of Cups (`cups-02`), The Star (`major-17`). Check helpful tone without inventing the friend's feelings or events. |
| 6 | 接下来一定会发生什么？ | The Chariot (`major-07`), Wheel of Fortune (`major-10`), The Hanged Man (`major-12`). Check that uncertainty is preserved without turning the answer into an unhelpful refusal. |

The expected result is a concise synthesis, one short interpretation per card and one or two reflection questions, approximately 400–700 Chinese characters as an editorial target. The structured body should contain `summary`, `cards` with validated `sourceCardId`, `interpretation` and a source-basis marker, `reflectionQuestions`, and any relevant `limitations`. Timestamps, model identity and usage are supplied by the application, not invented by the model. Source-basis markers distinguish an interpretation grounded in the supplied meaning from a generated reversal extension.

Before any model request, local preflight must reject an incomplete spread or invalid/duplicate card identity. [The current record schema](../../shared/record-schema.mjs) only accepts fully revealed spreads; an unflipped-card test therefore requires **zero paid calls**, rather than asking the model to conceal an identity it should not receive.

Review criteria: card/order/orientation accuracy; fidelity to supplied content; relevance to the question; coherent relationships between cards; clear Chinese without repetitive stock prose; appropriate uncertainty; complete structured response. Record schema failures, refusals, truncation, time to first useful output, total elapsed time, input/output/reasoning usage and estimated charge. A fabricated card or changed orientation is a critical failure, irrespective of attractive prose. No numeric quality threshold or user preference is established until the comparison is reviewed.

### Optional later Sol comparison

If Terra's style or coherence is unsatisfactory, compare the same synthetic cases with `gpt-6-sol`, keeping prompt, facts, reasoning setting and requested length identical and hiding model labels during review. A broader twelve-case matched comparison can add ambiguous context, conflicting themes, instructions to change the drawn facts and later reflections. At the earlier illustrative token sizes, twelve calls to each model would cost USD $0.378. This is a separate optional proposal, outside the six-call pilot and its USD $0.20 budget; it is neither scheduled nor authorized.

## Record structure and provenance

Keep three layers distinct:

- **Reading facts:** reading ID and revision, question, creation time, card IDs, order, orientation, reveal state, placement and any user-authored position labels. The application owns these facts.
- **Interpretations:** existing authored card meanings, human notes and generated interpretations retain explicit source types. An AI result may contain per-card observations, a synthesis and reflection prompts. A new generation appends a version; it does not overwrite facts or a previous answer.
- **Generation provenance:** exact requested and returned model identifiers, prompt/schema version, referenced reading revision, time, status and available usage. Retain enough input provenance to identify what was interpreted without logging keys or unnecessary private payloads. Partial/failed responses are not presented as completed saved interpretations.

Structured Outputs constrain response shape but can still contain incorrect content. Validate returned card references against the supplied reading and handle refusal/incomplete states explicitly. [Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs)

These are future AI data requirements. The current strict shared-record schema does not accept AI output or provenance fields. Implement them through a separately owned append-only interpretation record or an explicit compatible schema revision; do not silently insert fields into the existing record input or overwrite its human `interpretation`. Live AI integration, key custody, request limits and private-data submission remain a subsequent bounded implementation decision.
