from __future__ import annotations
import copy, json, time
from pathlib import Path
import pytest
from rtl360_gtfl.archive import NativeCaptureArchive, full_frame, full_event
from rtl360_gtfl.canonical import content_hash
from rtl360_gtfl.config import GTFLModelConfig
from rtl360_gtfl.model import RTL360GTFLModel

SEED = 2718
def model():
    config = GTFLModelConfig.tiny(vocabulary_size=16, positive_state_lanes=8, occupied_threshold_banks=3)
    result = RTL360GTFLModel(config, seed=SEED).cpu()
    assert sum(p.numel() for p in result.parameters()) == 404
    return result

def infer(current, archive=None, capsule='public-dossier-archive-probe'):
    return current.infer_token(3, token_time=0, prior_records=(), sequence_id='public-dossier-archive-sequence',
                              capsule_id=capsule, approved_memory_records=(), archive=archive)

def hashes(result, archive=None):
    snapshot = result['snapshot']
    frames = snapshot['threshold_frames']
    events = snapshot['semantic_ledger']['events']
    if archive is not None:
        frames = [full_frame(item, archive.resolve) for item in frames]
        events = [full_event(item, archive.resolve) for item in events]
    return {'distribution': content_hash(result['distribution']), 'crscRecord': content_hash(result['crsc_record']),
            'collapseRecord': content_hash(result['collapse_record']), 'frames': content_hash(frames),
            'events': content_hash(events), 'frameCount': len(frames), 'eventCount': len(events)}

def test_full_and_archive_shared_semantics_match(tmp_path):
    baseline = infer(model())
    archive = NativeCaptureArchive(tmp_path / 'archive')
    candidate = infer(model(), archive)
    assert hashes(baseline) == hashes(candidate, archive)

def test_reopen_materializes_without_inference(tmp_path, monkeypatch):
    archive = NativeCaptureArchive(tmp_path / 'archive')
    result = infer(model(), archive)
    expected = hashes(result, archive)
    def forbidden(*args, **kwargs):
        raise AssertionError('INFERENCE_DURING_REOPEN')
    monkeypatch.setattr(RTL360GTFLModel, 'infer_token', forbidden)
    reader = NativeCaptureArchive.open(archive.root)
    reopened = {**result, 'snapshot': reader.snapshot}
    assert hashes(reopened, reader) == expected
    assert reader.performance_envelope(reader.snapshot)['availability'] == 'UNAVAILABLE'

def test_missing_generated_object_rejects_reopen(tmp_path):
    archive = NativeCaptureArchive(tmp_path / 'archive')
    infer(model(), archive)
    reference = archive.manifest()['objects'][0]
    target = archive.root / 'objects' / (reference['sha256'] + '.json')
    assert target.is_file()
    target.unlink()
    with pytest.raises(ValueError):
        NativeCaptureArchive.open(archive.root)

def test_snapshot_and_resolved_objects_are_detached(tmp_path):
    archive = NativeCaptureArchive(tmp_path / 'archive')
    infer(model(), archive)
    snapshot = archive.snapshot
    snapshot_root = content_hash(snapshot)
    reference = archive.manifest()['objects'][0]
    payload = archive.resolve(reference)
    payload_root = content_hash(payload)
    snapshot.clear()
    payload.clear()
    assert content_hash(archive.snapshot) == snapshot_root
    assert content_hash(archive.resolve(reference)) == payload_root
    reader = NativeCaptureArchive.open(archive.root)
    assert content_hash(reader.snapshot) == snapshot_root
    assert content_hash(reader.resolve(reference)) == payload_root

def capture_public_summary(protocol, root):
    assert protocol['pairs'] == 8 and protocol['warmupArms'] == 2 and protocol['seed'] == SEED
    root = Path(root)
    root.mkdir(exist_ok=False)
    arms, pairs, warmups = [], [], []
    def arm(index, mode, warmup=False):
        current = model()
        container = root / (('warmup-' if warmup else 'pair-') + str(index) + '-' + mode)
        container.mkdir(exist_ok=False)
        archive = NativeCaptureArchive(container / 'archive') if mode == 'sealed_archive_v2' else None
        started, stopped = None, None
        try:
            started = time.perf_counter_ns()
            result = infer(current, archive, capsule='public-dossier-archive-case-' + str(index))
            stopped = time.perf_counter_ns()
            semantic_hashes = hashes(result, archive)
            returned_bytes = len(json.dumps(result, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8'))
            stored_bytes, stored_files, timing_bytes, reopened = None, None, None, None
            if archive is not None:
                # Observed timing is deliberately outside the sealed semantic directory.
                timing = json.dumps(archive.performance_envelope(archive.snapshot), sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
                (container / 'observed-timing.json').write_bytes(timing)
                timing_bytes = len(timing)
                files = sorted(item for item in container.rglob('*') if item.is_file())
                assert all(not item.is_symlink() for item in files)
                stored_bytes, stored_files = sum(item.stat().st_size for item in files), len(files)
                reader = NativeCaptureArchive.open(archive.root)
                reopened = hashes({**result, 'snapshot': reader.snapshot}, reader) == semantic_hashes
                assert reopened
            return {'pair': index, 'mode': mode, 'status': 'FULFILLED', 'durationMs': (stopped-started)/1_000_000,
                    'sharedHashes': semantic_hashes, 'returnedJsonBytes': returned_bytes, 'storedArchiveAndTimingBytes': stored_bytes,
                    'storedFilesIncludingTiming': stored_files, 'timingSidecarBytes': timing_bytes, 'reopenedSharedHashesEqual': reopened,
                    'errorType': None}
        except Exception as error:
            now = time.perf_counter_ns()
            return {'pair': index, 'mode': mode, 'status': 'FAILED', 'durationMs': ((stopped or now)-started)/1_000_000 if started else None,
                    'sharedHashes': None, 'returnedJsonBytes': None, 'storedArchiveAndTimingBytes': None,
                    'storedFilesIncludingTiming': None, 'timingSidecarBytes': None, 'reopenedSharedHashesEqual': None,
                    'errorType': type(error).__name__}
    for mode in ('full_capture_v1', 'sealed_archive_v2'):
        warmups.append(arm(-1, mode, True))
    for index in range(protocol['pairs']):
        order = ('full_capture_v1', 'sealed_archive_v2') if index % 2 == 0 else ('sealed_archive_v2', 'full_capture_v1')
        observed = [arm(index, mode) for mode in order]
        arms.extend(observed)
        by_mode = {item['mode']: item for item in observed}
        baseline, candidate = by_mode['full_capture_v1'], by_mode['sealed_archive_v2']
        fulfilled = all(item['status'] == 'FULFILLED' for item in observed)
        equal = fulfilled and baseline['sharedHashes'] == candidate['sharedHashes']
        pairs.append({'pair': index, 'order': list(order), 'eligible': equal, 'sharedHashesEqual': equal,
                      'baselineMs': baseline['durationMs'], 'candidateMs': candidate['durationMs'],
                      'baselineJsonBytes': baseline['returnedJsonBytes'], 'candidateJsonBytes': candidate['returnedJsonBytes'],
                      'reason': None if equal else 'ARM_FAILURE_OR_SHARED_SEMANTICS_DIFFER'})
    return {'schemaVersion': 1, 'classification': 'fresh_cpu_synthetic_native_archive_representation', 'measurementProtocol': protocol,
            'requestedInferenceCalls': 18, 'recordedArms': len(arms)+len(warmups), 'warmups': warmups, 'arms': arms, 'pairs': pairs,
            'qualityGate': {'totalPairs': len(pairs), 'eligiblePairs': sum(item['eligible'] for item in pairs),
                            'failedPairs': sum(not item['eligible'] for item in pairs), 'allWarmupsFulfilled': all(item['status']=='FULFILLED' for item in warmups)},
            'hostedTokens': None, 'cost': None, 'hostedLatencyMs': None, 'modelQuality': None, 'defaultModelBaseline': None,
            'interpretationLimits': {'optimizerSteps': 0, 'telemetryDisabledArm': False, 'crscEvictionTested': False,
                                     'originalSuiteInferenceCalls': None, 'rawCapturesPublished': False, 'sourceRedistributed': False}}
