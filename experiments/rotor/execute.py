from __future__ import annotations
import importlib.metadata
import importlib.util
import json
import os
import sys
from pathlib import Path
ROOT = Path(sys.argv[1]).resolve(strict=True)
if not ROOT.name.startswith('.rotor-source-check-'):
    raise RuntimeError('OWNED_COPY_REQUIRED')
sys.dont_write_bytecode = True
os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD'] = '1'
sys.path.insert(0, str(ROOT / '04_NEURAL_CORE'))
FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
def checked(value):
    if isinstance(value, int):
        return
    if isinstance(value, bytes):
        value = os.fsdecode(value)
    if isinstance(value, str):
        target = Path(value).resolve(strict=False)
        if target != ROOT and ROOT not in target.parents:
            raise PermissionError('WRITE_OUTSIDE_OWNED_COPY')
def guard(event, args):
    if event.startswith('socket.') or event in ('subprocess.Popen', 'os.system', 'os.posix_spawn', 'os.posix_spawnp'):
        raise PermissionError('NETWORK_OR_SUBPROCESS_DISABLED')
    if event == 'open' and args:
        mode, flags = args[1] if len(args) > 1 else None, args[2] if len(args) > 2 else 0
        if (isinstance(mode, str) and any(c in mode for c in 'wax+')) or (isinstance(flags, int) and flags & FLAGS):
            checked(args[0])
    if event in ('os.remove', 'os.unlink', 'os.mkdir', 'os.rmdir', 'os.rename', 'os.replace') and args:
        for item in args[:2] if event in ('os.rename', 'os.replace') else args[:1]:
            checked(item)
sys.addaudithook(guard)
import pytest
class Results:
    def __init__(self):
        self.collected, self.phases, self.collection_errors = [], {}, []
    def pytest_collection_finish(self, session):
        self.collected = [item.nodeid for item in session.items]
    def pytest_collectreport(self, report):
        if report.failed:
            self.collection_errors.append({'id': report.nodeid, 'status': 'ERROR'})
    def pytest_runtest_logreport(self, report):
        status = 'PASSED' if report.passed else 'SKIPPED' if report.skipped else 'FAILED' if report.when == 'call' else 'ERROR'
        self.phases.setdefault(report.nodeid, []).append({'phase': report.when, 'status': status})
    def summary(self):
        items = []
        for node in self.collected:
            phases = self.phases.get(node, [])
            states = {p['status'] for p in phases}
            state = next((s for s in ('ERROR', 'FAILED', 'SKIPPED') if s in states),
                         'PASSED' if any(p['phase'] == 'call' and p['status'] == 'PASSED' for p in phases) else 'ERROR')
            items.append({'id': node, 'status': state})
        return {'collected': len(items), 'passed': sum(i['status'] == 'PASSED' for i in items),
                'failed': sum(i['status'] == 'FAILED' for i in items), 'skipped': sum(i['status'] == 'SKIPPED' for i in items),
                'errors': sum(i['status'] == 'ERROR' for i in items) + len(self.collection_errors),
                'results': items, 'collectionErrors': self.collection_errors}
results, traces, failure, code = Results(), None, None, None
libraries = {'pytest': importlib.metadata.version('pytest')}
try:
    if sys.version_info[:2] != (3, 12) or libraries['pytest'] != '9.1.1':
        raise RuntimeError('DEPENDENCY_VERSION_MISMATCH')
    code = int(pytest.main(['-q', '-p', 'no:cacheprovider', '-p', 'no:logging', '--basetemp', str(ROOT / 'pytest-state'),
                           str(ROOT / 'tests/test_gtfl_rotor_lattice.py'), str(ROOT / 'probe.py')], plugins=[results]))
    spec = importlib.util.spec_from_file_location('dossier_rotor_probe', ROOT / 'probe.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    traces = module.capture_public_traces(json.loads((ROOT / 'protocol.json').read_text(encoding='utf-8')))
except BaseException as error:
    failure = {'type': type(error).__name__, 'code': getattr(error, 'code', None)}
summary = results.summary()
passed = code == 0 and summary['passed'] == 15 and summary['failed'] == 0 and summary['skipped'] == 0 and summary['errors'] == 0 and failure is None and traces is not None and traces['denominator']['excludedCases'] == 0
report = {'schemaVersion': 1, 'status': 'PASSED' if passed else 'FAILED', 'pythonVersion': sys.version,
          'libraries': libraries, 'pytestExitCode': code, 'tests': summary, 'traces': traces, 'executionError': failure}
(ROOT / 'reports/execution.json').write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + '\n', encoding='utf-8')
print(json.dumps({'status': report['status'], 'tests': summary['collected'], 'passed': summary['passed']}))
raise SystemExit(0 if passed else 1)
