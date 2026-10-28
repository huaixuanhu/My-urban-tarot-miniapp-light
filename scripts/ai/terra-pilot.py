"""Bounded manual pilot; see governance/STATE.md stage2.5.2.1.

Dry run is offline. --run requires the approved credential path and a fresh
result directory. No automatic retry, app integration, or database writes.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
MODEL = 'gpt-6.1-terra'
MAX_INPUT = 4000
MAX_OUTPUT = 3000
BUDGET = 0.20
# 4000 input at the higher $2.50 cache-write rate + 3000 output at $5,
# plus 10% headroom for regional processing, rounded upward per attempt.
RESERVE = 0.03
BASE = 'https://api.openai.com/v1'


def read_json(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def object_schema(properties):
    return {'type': 'object', 'properties': properties,
            'required': list(properties), 'additionalProperties': False}


def build_input(case, source):
    cards = []
    seen = set()
    for c in case['cards']:
        card_id = c['sourceCardId']
        if card_id not in source or card_id in seen or c.get('faceUp', True) is not True:
            raise ValueError('Unknown, duplicate or hidden card; no request permitted.')
        if type(c['reversed']) is not bool or not (c['positionLabel'] is None or isinstance(c['positionLabel'], str)):
            raise ValueError('Invalid orientation or position label.')
        seen.add(card_id)
        card = source[card_id]
        cards.append({**{k: c[k] for k in ('sourceCardId', 'reversed', 'positionLabel')},
                      'faceUp': True, 'name': card['name'], 'theme': card['theme'],
                      'providedMeaning': card['interpretation'],
                      'urbanImagery': card.get('urbanImagery'),
                      'sourceReversedMeaning': card.get('reversedInterpretation')})
    if len(cards) != 3:
        raise ValueError('This pilot expects exactly three revealed cards.')
    return {'deck': 'Urban Tarot', 'question': case['question'], 'spreadType': 'free', 'cards': cards}


def make_payload(reading, prompt):
    card_schema = object_schema({
        'sourceCardId': {'type': 'string', 'enum': [c['sourceCardId'] for c in reading['cards']]},
        'reversed': {'type': 'boolean'},
        'positionLabel': {'type': ['string', 'null']},
        'interpretation': {'type': 'string'},
        'basis': {'type': 'string', 'enum': ['provided_meaning', 'generated_reversal_extension']},
    })
    schema = object_schema({
        'summary': {'type': 'string'},
        'cards': {'type': 'array', 'minItems': 3, 'maxItems': 3, 'items': card_schema},
        'reflectionQuestions': {'type': 'array', 'minItems': 1, 'maxItems': 2, 'items': {'type': 'string'}},
        'limitations': {'type': 'array', 'items': {'type': 'string'}},
    })
    return {'model': MODEL, 'instructions': prompt,
            'input': json.dumps(reading, ensure_ascii=False), 'reasoning': {'effort': 'low'},
            'text': {'format': {'type': 'json_schema', 'name': 'urban_tarot_pilot', 'strict': True, 'schema': schema}},
            'max_output_tokens': MAX_OUTPUT, 'store': False, 'service_tier': 'default'}


def validate_answer(answer, reading):
    if set(answer) != {'summary', 'cards', 'reflectionQuestions', 'limitations'}:
        raise ValueError('Unexpected answer shape.')
    if not isinstance(answer['summary'], str) or not answer['summary'].strip() or len(answer['cards']) != 3:
        raise ValueError('Missing answer content.')
    for actual, expected in zip(answer['cards'], reading['cards']):
        if set(actual) != {'sourceCardId', 'reversed', 'positionLabel', 'interpretation', 'basis'}:
            raise ValueError('Unexpected card shape.')
        for key in ('sourceCardId', 'reversed', 'positionLabel'):
            if actual[key] != expected[key] or type(actual[key]) is not type(expected[key]):
                raise ValueError('Answer changed card order, orientation or position label.')
        basis = 'generated_reversal_extension' if expected['reversed'] else 'provided_meaning'
        if actual['basis'] != basis or not isinstance(actual['interpretation'], str) or not actual['interpretation'].strip():
            raise ValueError('Invalid interpretation source marker.')
    if not isinstance(answer['reflectionQuestions'], list) or not 1 <= len(answer['reflectionQuestions']) <= 2:
        raise ValueError('Expected one or two reflection questions.')
    if not isinstance(answer['limitations'], list):
        raise ValueError('Invalid limitations.')
    if not all(isinstance(s, str) and s.strip() for s in answer['reflectionQuestions'] + answer['limitations']):
        raise ValueError('Expected nonempty text items.')
    if any(c['reversed'] for c in reading['cards']) and not answer['limitations']:
        raise ValueError('Reversal extension needs a visible source limitation.')


def load_key(path):
    # Existing credential stays in its original location; RTF conversion is memory-only.
    path = path.resolve()
    if path.stat().st_mode & 0o077:
        raise ValueError('Credential file must have mode 0600.')
    raw = path.read_bytes()
    if raw.startswith(b'{\\rtf'):
        raw = subprocess.check_output(['textutil', '-convert', 'txt', '-stdout', str(path)])
    matches = re.findall(r'^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*[\x22\x27]?(sk-[A-Za-z0-9_-]+)[\x22\x27]?\s*$', raw.decode('utf-8-sig'), re.M)
    if len(matches) != 1 or len(matches[0]) < 30:
        raise ValueError('Expected one nonempty OPENAI_API_KEY assignment.')
    return matches[0]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def api_call(endpoint, body, key):
    request = urllib.request.Request(BASE + endpoint, data=json.dumps(body).encode(),
                                     headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    started = time.perf_counter()
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=120) as response:
            return json.load(response), {'httpStatus': response.status, 'requestId': response.headers.get('x-request-id'),
                                         'elapsedSeconds': round(time.perf_counter() - started, 3)}
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read()).get('error', {})
        except (ValueError, UnicodeDecodeError):
            detail = {}
        message = str(detail.get('message', 'No JSON error detail')).replace(key, '[REDACTED]')
        message = re.sub(r'sk-[A-Za-z0-9_-]+', '[REDACTED]', message)
        raise RuntimeError(f"HTTP {error.code}, code={detail.get('code')}, {message}") from None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', action='store_true')
    parser.add_argument('--key-file', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    cases = read_json(ROOT / 'scripts/ai/terra-pilot-cases.json')
    deck = read_json(ROOT / 'client/src/data/tarotData.json')
    source = {c['id']: c for c in deck['majorArcana'] + [c for suit in deck['minorArcana'].values() for c in suit['cards']]}
    prompt = (ROOT / 'scripts/ai/terra-pilot-prompt.txt').read_text()
    assert len(cases) == 6 and len({c['id'] for c in cases}) == 6 and len(cases) * RESERVE <= BUDGET
    readings = [build_input(c, source) for c in cases]
    payloads = [make_payload(r, prompt) for r in readings]
    for field, value in [('sourceCardId', 'missing'), ('faceUp', False)]:
        invalid = copy.deepcopy(cases[0]); invalid['cards'][0][field] = value
        try:
            build_input(invalid, source)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid reading reached request preparation.')
    duplicate = copy.deepcopy(cases[0]); duplicate['cards'][1] = duplicate['cards'][0]
    try:
        build_input(duplicate, source)
    except ValueError:
        pass
    else:
        raise AssertionError('Duplicate card accepted.')
    print(json.dumps({'mode': 'live' if args.run else 'offline', 'model': MODEL, 'cases': len(cases),
                      'budgetUSD': BUDGET, 'maximumReservedUSD': round(len(cases) * RESERVE, 2),
                      'offlineInputChecks': 'passed'}), flush=True)
    if not args.run:
        return
    if not args.key_file or not args.output:
        parser.error('--run requires --key-file and a fresh --output directory')
    key = load_key(args.key_file)
    os.umask(0o077)
    args.output.mkdir(parents=True, exist_ok=False)  # Deliberate: never replay an ambiguous run.
    ledger = {'model': MODEL, 'budgetUSD': BUDGET, 'reservedUSD': 0, 'attempts': [],
              'promptSha256': hashlib.sha256(prompt.encode()).hexdigest(), 'status': 'counting_inputs'}
    save(args.output / 'ledger.json', ledger)
    try:
        for case, payload in zip(cases, payloads):
            counted, meta = api_call('/responses/input_tokens', {k: payload[k] for k in ('model', 'instructions', 'input', 'text', 'reasoning')}, key)
            count = counted.get('input_tokens')
            if type(count) is not int or count < 1 or count > MAX_INPUT:
                raise ValueError('Input token count exceeds this pilot scope.')
            save(args.output / f"{case['id']}-input.json", {'case': case, 'request': payload, 'count': counted, 'countMeta': meta})
            print(json.dumps({'case': case['id'], 'inputTokens': count}), flush=True)
        ledger['status'] = 'generating'; save(args.output / 'ledger.json', ledger)
        for case, reading, payload in zip(cases, readings, payloads):
            if ledger['reservedUSD'] + RESERVE > BUDGET:
                raise ValueError('Budget exhausted; no request sent.')
            ledger['reservedUSD'] = round(ledger['reservedUSD'] + RESERVE, 6)
            attempt = {'case': case['id'], 'status': 'sending', 'reservedUSD': RESERVE}
            ledger['attempts'].append(attempt); save(args.output / 'ledger.json', ledger)
            response, meta = api_call('/responses', payload, key)
            save(args.output / f"{case['id']}-response.json", {'response': response, 'meta': meta})
            attempt.update(meta); attempt['usage'] = response.get('usage')
            attempt['responseId'] = response.get('id'); attempt['returnedModel'] = response.get('model')
            if response.get('status') != 'completed' or not str(response.get('model', '')).startswith(MODEL):
                raise ValueError('Incomplete response or unexpected model; no automatic retry.')
            text = ''.join(part['text'] for item in response.get('output', []) if item.get('type') == 'message'
                           for part in item.get('content', []) if part.get('type') == 'output_text')
            answer = json.loads(text)
            validate_answer(answer, reading)
            save(args.output / f"{case['id']}-answer.json", answer)
            attempt['status'] = 'validated'; save(args.output / 'ledger.json', ledger)
            print(json.dumps(attempt, ensure_ascii=False), flush=True)
        ledger['status'] = 'completed'; save(args.output / 'ledger.json', ledger)
    except Exception as error:
        message = str(error).replace(key, '[REDACTED]')
        message = re.sub(r'sk-[A-Za-z0-9_-]+', '[REDACTED]', message)
        ledger['status'] = 'stopped'; ledger['error'] = message
        save(args.output / 'ledger.json', ledger)
        raise SystemExit(message) from None


if __name__ == '__main__':
    main()
