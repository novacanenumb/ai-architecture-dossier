from __future__ import annotations
import copy
import json
import pytest
from rtl360_gtfl.config import GTFLModelConfig
from rtl360_gtfl.lattice import hilbert_point, route_imports
from rtl360_gtfl.rotor import phase_addresses, circular_support, resonant_support
from rtl360_gtfl.numeric import Q_W
from rtl360_gtfl.canonical import content_hash

TIMES = (2, 10, 33, 65)
PHASES = ((10000, 20000), (30000, 40000), (50000, 60000))
ETA = ((Q_W,) * 4,) * 3
CONFIG = GTFLModelConfig.tiny(maximum_imports=16, maximum_ray_cells=8)

def fixture(token_time):
    records = []
    for index in range(max(0, token_time - 16), token_time):
        root = content_hash({'kind': 'public-dossier-rotor', 'index': index})
        records.append({'record_hash': root, 'token_time': index,
                        'lattice_cell': list(hilbert_point(index, 5)),
                        'rotor_phases': [list(p) for p in PHASES], 'source_roots': [root]})
    return {'phases': [list(p) for p in PHASES], 'eta': [list(row) for row in ETA],
            'records': records, 'token_time': token_time}

def route(data, config=CONFIG):
    return route_imports(data['phases'], data['eta'], data['records'], data['token_time'], config)

def local_required(data):
    return {r['record_hash'] for r in data['records'] if 1 <= data['token_time'] - r['token_time'] <= 8}

def local_delivered(result):
    return {a['record_hash'] for a in result['arrivals'] if 'LOCAL_WINDOW' in a['route_classes']}

def test_repeated_public_routes_and_hashes_are_identical_without_input_changes():
    for time in TIMES:
        data = fixture(time)
        before = copy.deepcopy(data)
        first, second = route(data), route(data)
        assert first == second
        assert content_hash(first) == content_hash(second)
        assert data == before

def test_candidate_domain_overflow_rejects_instead_of_silently_truncating():
    with pytest.raises(ValueError, match='maximum_imports'):
        route(fixture(2), GTFLModelConfig.tiny(maximum_imports=1, maximum_ray_cells=8))

def test_current_and_future_imports_reject_before_a_trusted_route_result():
    for offset in (0, 1):
        data = fixture(10)
        data['records'][0]['token_time'] = data['token_time'] + offset
        with pytest.raises(ValueError, match='future or current'):
            route(data)

def test_phase_shape_and_boolean_inputs_reject_with_bounded_valid_support():
    with pytest.raises(ValueError, match='two through five'):
        phase_addresses([Q_W, 0], [[Q_W, Q_W]], [[Q_W, Q_W]])
    with pytest.raises(ValueError, match='hidden support'):
        phase_addresses([True, 0], [[Q_W, Q_W]] * 3, [[Q_W, Q_W]] * 3)
    valid = phase_addresses([Q_W, 0], [[Q_W, Q_W]] * 3, [[Q_W, Q_W]] * 3)
    assert len(valid) == 3 and all(0 <= p < 360000 for pair in valid for p in pair)
    assert 0 <= circular_support(0, 359999) <= Q_W
    assert circular_support(0, 180000) == 0
    assert resonant_support(PHASES, PHASES, ETA)['support'] == Q_W

def test_local_window_recall_and_every_admitted_ceiling_and_ray_are_bounded():
    for time in TIMES:
        data = fixture(time)
        result = route(data)
        assert local_delivered(result) == local_required(data)
        supplied = {r['record_hash'] for r in data['records']}
        assert all(a['record_hash'] in supplied for a in result['arrivals'])
        for a in result['arrivals']:
            assert a['arrival_ceiling'] == min(a['resonance'], a['recency_support'])
            assert 0 <= a['arrival_ceiling'] <= Q_W
        assert len(result['rays']) == 3
        assert all(len(ray['cells']) <= 8 for ray in result['rays'])

def test_returned_source_roots_are_detached_from_later_input_mutation():
    data = fixture(10)
    result = route(data)
    before = copy.deepcopy(result)
    for record in data['records']:
        record['source_roots'].append('public-late-mutation')
    assert result == before

def capture_public_traces(protocol):
    expected = {'schemaVersion': 1, 'id': 'public-dossier-rotor/1', 'source': 'public_synthetic_fixture',
                'times': list(TIMES), 'phases': [list(p) for p in PHASES], 'eta': [list(row) for row in ETA],
                'config': {'preset': 'tiny', 'maximum_imports': 16, 'maximum_ray_cells': 8, 'axles': 3,
                           'harmonics': [1, 2, 4, 8], 'phase_resolution': 360000, 'lattice_levels': 5},
                'callsPerCase': 2, 'cases': 4}
    if protocol != expected:
        raise ValueError('FROZEN_PROTOCOL_MISMATCH')
    cases, recorded, failed = [], 0, 0
    for time in TIMES:
        data, results, errors = fixture(time), [], []
        before = copy.deepcopy(data)
        for attempt in range(2):
            recorded += 1
            try:
                results.append(route(data))
            except Exception as error:
                failed += 1
                results.append(None)
                errors.append({'attempt': attempt + 1, 'type': type(error).__name__})
        first, second = results
        required = local_required(before)
        delivered = local_delivered(first) if first is not None else set()
        case = {'tokenTime': time, 'publicInput': before, 'result': first,
                'replayEqual': first is not None and second is not None and first == second,
                'traceHash': content_hash(first) if first is not None else None,
                'replayTraceHash': content_hash(second) if second is not None else None,
                'requiredLocalCount': len(required), 'deliveredLocalCount': len(delivered),
                'routeCount': len(first['arrivals']) if first is not None else None,
                'inputUnchanged': data == before, 'failures': errors}
        case['canonicalJsonBytes'] = len(json.dumps(case, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
        cases.append(case)
    return {'schemaVersion': 1, 'classification': 'ORIGINAL_PURE_MATH_PUBLIC_SYNTHETIC_TRACE',
            'protocol': copy.deepcopy(protocol), 'cases': cases,
            'denominator': {'cases': 4, 'requestedRouteCalls': 8, 'recordedRouteCalls': recorded,
                            'failedRouteCalls': failed,
                            'excludedCases': sum(bool(c['failures'] or not c['replayEqual'] or not c['inputUnchanged'] or c['requiredLocalCount'] != c['deliveredLocalCount']) for c in cases)},
            'canonicalJsonByteScope': 'case object before adding canonicalJsonBytes; sorted compact JSON with literal Unicode',
            'providerCalls': 0, 'hostedTokens': None, 'billedCost': None, 'hostedLatencyMs': None,
            'modelQuality': None, 'defaultModelBaseline': None, 'cameraIsolation': None,
            'crossSequenceIsolation': None, 'trainingOrCheckpointBehavior': None}
