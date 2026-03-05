"""Shared pytest setup for API tests."""

import os
import tempfile

TMP_DATA_ROOT = tempfile.mkdtemp(prefix="essaybuddy-tests-")
os.environ["DATA_ROOT"] = TMP_DATA_ROOT
