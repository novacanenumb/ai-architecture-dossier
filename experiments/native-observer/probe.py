from __future__ import annotations

import copy
import pytest
from rtl360_gtfl.observability import observability_contract, event_coordinates, source_epoch_id

CAPSULE_ID = 'public-dossier-observer'


def _coordinates(previous_event=None, *, frame_q: int = 0, source_epoch_index: int = 0,
                 token_index: int | None = 0, source_id: str = ''):
    coordinates = event_coordinates(previous_event, capsule_id=CAPSULE_ID, frame_q=frame_q,
                                    source_epoch_index=source_epoch_index, token_index=token_index,
                                    source_id=source_id)
    return {**coordinates, 'capsule_id': CAPSULE_ID}


def test_observability_contract_returns_fresh_nested_lists() -> None:
    first, second = observability_contract(), observability_contract()
    pristine = copy.deepcopy(second)
    assert first is not second
    assert first['replay_order'] is not second['replay_order']
    assert first['time_bases'] is not second['time_bases']
    first['replay_order'].append('caller-mutation')
    first['time_bases'].append('caller-mutation')
    first['caller_field'] = True
    assert second == pristine
    assert 'caller-mutation' not in second['replay_order']
    assert 'caller-mutation' not in second['time_bases']
    assert 'caller_field' not in second


def test_same_frame_keeps_clock_stable_while_token_and_source_can_change() -> None:
    first = _coordinates(None, frame_q=11, source_epoch_index=2, token_index=0,
                         source_id='public-source-a')
    second = _coordinates(first, frame_q=11, source_epoch_index=2, token_index=1,
                          source_id='public-source-b')
    third = _coordinates(second, frame_q=11, source_epoch_index=2, token_index=None, source_id='')
    assert first['logical_clock'] == 0
    assert second['logical_clock'] == first['logical_clock']
    assert third['logical_clock'] == second['logical_clock']
    assert second['token_index'] == 1
    assert second['source_id'] == 'public-source-b'
    assert third['token_index'] is None


def test_new_frame_and_source_epoch_advance_clock_and_epoch_identity() -> None:
    first = _coordinates(None, frame_q=4, source_epoch_index=0, token_index=0)
    new_frame = _coordinates(first, frame_q=5, source_epoch_index=0, token_index=1)
    new_epoch = _coordinates(new_frame, frame_q=5, source_epoch_index=1, token_index=2)
    assert first['logical_clock'] == 0
    assert new_frame['logical_clock'] == 1
    assert new_epoch['logical_clock'] == 2
    assert source_epoch_id(CAPSULE_ID, 0) != source_epoch_id(CAPSULE_ID, 1)
    assert source_epoch_id(CAPSULE_ID, 0) == source_epoch_id(CAPSULE_ID, 0)


def test_coordinate_integer_fields_reject_booleans_nonintegers_and_negatives() -> None:
    invalid_values = (True, False, 1.5, '1', -1)
    for field in ('frame_q', 'source_epoch_index'):
        for invalid in invalid_values:
            arguments = {'frame_q': 0, 'source_epoch_index': 0, 'token_index': 0}
            arguments[field] = invalid
            with pytest.raises((TypeError, ValueError)):
                _coordinates(None, **arguments)
    for invalid in invalid_values:
        with pytest.raises((TypeError, ValueError)):
            _coordinates(None, frame_q=0, source_epoch_index=0, token_index=invalid)
    assert _coordinates(None, frame_q=0, source_epoch_index=0, token_index=None)['token_index'] is None
