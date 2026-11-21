# Save from the AI reading

Derived from governance/STATE.md stage2.5.18 and accepted DESIGN.md revision40. The owner accepted revision41 on 2026-11-21. This comparison covers the reading, direct-save and receipt flows in the existing private shared-record model.

## What the review found

| Observed issue | Local change |
| --- | --- |
| In a 1280×900 browser the original save entry started at y=1262 for a single-card result. Clicking it opened another form. | Completed results open in reading mode. A compact save action stays available while reading at ordinary viewport heights. |
| Choosing an older result changed the answer while the last submission and the record editor could refer to other versions. | Each reading shows its own question and settings. Direct save attaches exactly the displayed ID. The complete record form keeps its multi-select option. |
| A lost acknowledgement followed by an authentication rejection on retry could discard an already-written ID. | Both entry points reuse the same pending ID and frozen content until success. After acknowledgement, a separate action opens the stored version. |
| Searches for an open-ended question could return sources yet show a large empty fact-check section. | The answer leads. Citations for specific claims remain adjacent. Uncited URLs actually returned by the search appear under a compact disclosure. An empty URL list is identified explicitly. |

## Community references

Open WebUI attaches an action for adding an individual assistant response to a note. Zotero lets the reader save the current item in context and indicates the destination. We applied these patterns to the selected answer and its shared-record receipt. [Open WebUI Notes](https://docs.openwebui.com/features/notes/#chat-sidebar) · [Zotero Connector](https://www.zotero.org/support/adding_items_to_zotero#saving_to_a_specific_collection_or_library)

W3C describes success and error messages that assistive technology can announce while focus stays on the current task. The local save uses a status region and an explicit link to the stored reading. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Scope of the result

Additional search links describe the provider’s search output. The application stores specific claim-to-source associations separately. This UI change can display existing evidence in historical readings without reissuing a search or modifying the stored interpretation. Verifying individual statements inside the free-text synthesis would require a separate output contract.

## Local verification

The browser comparison used the released build and loopback synthetic records. Both 1280×900 and 390×844 showed an actionable save on the first completed-result screen. Each save issued one record POST and kept the AI panel open. On desktop the test switched from the second answer to the first, saved it, read the stored record back through the local API, opened its detail and returned to the original version. The mobile run used a simulated web-enabled answer. Both runs recorded zero application exceptions or horizontal overflow.

| State | Desktop | Mobile |
| --- | --- | --- |
| Previous flow | [Before](before-ai-result.jpg) | |
| Reading and saving | [Result](desktop-result.jpg) | [Result](mobile-result.jpg) |
| Confirmed save | [Receipt](desktop-saved.jpg) | [Receipt](mobile-saved.jpg) |

In the [seven-card reading](desktop-long-result.jpg), the result panel could scroll 645 pixels. At its bottom a single pointer click on the pinned action made one save request and left the reading open. In a separate loss-of-response run, the local server had written the record before the browser lost the acknowledgement. The retry sent the identical payload and the store contained one new record. For open-ended questions, browser checks covered zero claims with one search URL and zero claims with zero URLs. Each showed its respective collapsed source or search receipt.

The combined check passed 407 tests, governance, types, compiled runtime checks and the production build. Tests cover stale questions and rounds, multiple versions, a save already underway, malformed receipts and a lost acknowledgement followed by an authentication error. All 115 previously protected paths matched their recorded hashes. These checks used local fixtures. The [release receipt](../../release/stage2.5.18/README.md) tracks Production verification.
