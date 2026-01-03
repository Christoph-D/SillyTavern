// Jest setup, runs before all tests

import { setConfigForTesting } from '../src/util.js';

// Several modules call getConfigValue() at the module level.
// getConfigValue() fails if the config is unset, so we need to set the config before they are imported.
// Setting it in a test file is too late, which is why we need the separate Jest setup file.
setConfigForTesting({})
