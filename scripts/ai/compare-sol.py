"""Matched local comparison owned by STATE.md stage2.5.2.2.

Reuses frozen Terra requests, changes only model, and alternates model order.
Offline by default. No retries; original Terra evidence remains unchanged.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terra_pilot', HERE / 'terra-pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)
MODELS = ('gpt-6-sol', 'gpt-6.1-sol')
BUDGET = 0.80
# 4000 tokens at $5/MTok (12-hour write) + 3000 at $10/MTok,
# plus 10% regional headroom, rounded upward; twelve reservations total $0.72.
RESERVE = 0.06


def prepare(baseline):
    ledger = pilot.read_json(baseline / 'ledger.json')
    assert ledger['status'] == 'completed' and ledger['model'] == pilot.MODEL
    cases = pilot.read_json(HERE / 'terra-pilot-cases.json')
    prompt = (HERE / 'terra-pilot-prompt.txt').read_text()
    assert hashlib.sha256(prompt.encode()).hexdigest() == ledger['promptSha256']
    deck = pilot.read_json(pilot.ROOT / 'client/src/data/tarotData.json')
    source = {c['id']: c for c in deck['majorArcana'] + [c for s in deck['minorArcana'].values() for c in s['cards']]}
    jobs = []
    for i, case in enumerate(cases):
        original = pilot.read_json(baseline / f"{case['id']}-input.json")['request']
        reading = pilot.build_input(case, source)
        assert original == pilot.make_payload(reading, prompt), 'Frozen baseline differs from current input.'
        pilot.validate_answer(pilot.read_json(baseline / f"{case['id']}-answer.json"), reading)
        for model in MODELS if i % 2 == 0 else reversed(MODELS):
            body = copy.deepcopy(original)
            body['model'] = model
            assert {k: v for k, v in body.items() if k != 'model'} == {k: v for k, v in original.items() if k != 'model'}
            jobs.append({'model': model, 'case': case['id'], 'request': body, 'reading': reading})
    assert len(cases) == 6 and len(jobs) == 12 and len(jobs) * RESERVE <= BUDGET
    return jobs, ledger['promptSha256']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--run', action='store_true')
    parser.add_argument('--key-file', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    jobs, prompt_hash = prepare(args.baseline)
    print(json.dumps({'mode': 'live' if args.run else 'offline', 'models': MODELS, 'newGenerations': len(jobs),
                      'budgetUSD': BUDGET, 'maximumReservedUSD': round(RESERVE * len(jobs), 2),
                      'frozenPayloadEquality': True}), flush=True)
    if not args.run:
        return
    if not args.key_file or not args.output:
        parser.error('--run requires --key-file and a fresh --output directory')
    key = pilot.load_key(args.key_file)
    os.umask(0o077)
    args.output.mkdir(parents=True, exist_ok=False)
    for model in MODELS:
        (args.output / model).mkdir()
    ledger = {'models': MODELS, 'promptSha256': prompt_hash, 'budgetUSD': BUDGET,
              'reservedUSD': 0, 'attempts': [], 'status': 'counting_inputs'}
    pilot.save(args.output / 'ledger.json', ledger)
    try:
        for job in jobs:
            body = job['request']
            counted, meta = pilot.api_call('/responses/input_tokens', {k: body[k] for k in ('model', 'instructions', 'input', 'text', 'reasoning')}, key)
            count = counted.get('input_tokens')
            if type(count) is not int or not 0 < count <= pilot.MAX_INPUT:
                raise ValueError('Input count exceeds the bounded comparison.')
            pilot.save(args.output / job['model'] / f"{job['case']}-input.json", {'request': body, 'count': counted, 'countMeta': meta})
            print(json.dumps({'model': job['model'], 'case': job['case'], 'inputTokens': count}), flush=True)
        ledger['status'] = 'generating'; pilot.save(args.output / 'ledger.json', ledger)
        for job in jobs:
            if ledger['reservedUSD'] + RESERVE > BUDGET:
                raise ValueError('Comparison budget exhausted; no request sent.')
            ledger['reservedUSD'] = round(ledger['reservedUSD'] + RESERVE, 6)
            attempt = {'model': job['model'], 'case': job['case'], 'status': 'sending', 'reservedUSD': RESERVE}
            ledger['attempts'].append(attempt); pilot.save(args.output / 'ledger.json', ledger)
            response, meta = pilot.api_call('/responses', job['request'], key)
            dest = args.output / job['model']
            pilot.save(dest / f"{job['case']}-response.json", {'response': response, 'meta': meta})
            attempt.update(meta); attempt['usage'] = response.get('usage')
            attempt['responseId'] = response.get('id'); attempt['returnedModel'] = response.get('model')
            if response.get('model') != job['model'] and not str(response.get('model', '')).startswith(job['model'] + '-'):
                raise ValueError('Unexpected returned model; comparison stopped.')
            if response.get('status') != 'completed':
                attempt['status'] = 'incomplete'; attempt['incompleteDetails'] = response.get('incomplete_details')
            else:
                text = ''.join(p['text'] for item in response.get('output', []) if item.get('type') == 'message'
                               for p in item.get('content', []) if p.get('type') == 'output_text')
                try:
                    answer = json.loads(text)
                    pilot.validate_answer(answer, job['reading'])
                except (ValueError, TypeError, KeyError) as error:
                    attempt['status'] = 'invalid'; attempt['validationError'] = str(error)
                else:
                    pilot.save(dest / f"{job['case']}-answer.json", answer)
                    attempt['status'] = 'validated'
            pilot.save(args.output / 'ledger.json', ledger)
            print(json.dumps(attempt, ensure_ascii=False), flush=True)
        ledger['status'] = 'completed'; pilot.save(args.output / 'ledger.json', ledger)
    except Exception as error:
        message = re.sub(r'sk-[A-Za-z0-9_-]+', '[REDACTED]', str(error).replace(key, '[REDACTED]'))
        ledger['status'] = 'stopped'; ledger['error'] = message
        pilot.save(args.output / 'ledger.json', ledger)
        raise SystemExit(message) from None


if __name__ == '__main__':
    main()
