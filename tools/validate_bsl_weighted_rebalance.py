"""Compatibility command: validate current BSL v3, not the obsolete v2 constants.

The previous positional/first-entry assertions missed capacity and progression
failures. The v3 validator checks total recursive bounds, dedicated guarantees,
exact original rare probabilities, generator parity, and preserved shared tables.
"""
import runpy
from pathlib import Path
if __name__=='__main__':
    runpy.run_path(str(Path(__file__).with_name('validate_bsl_release_v3.py')),run_name='__main__')
