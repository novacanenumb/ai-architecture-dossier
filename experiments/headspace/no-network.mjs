// A fixture guard against accidental use of the default provider fetch.
// This is not operating-system network confinement; inspected tests inject mocked transport.
globalThis.fetch = async () => { throw new Error('HEADSPACE_FIXTURE_DEFAULT_NETWORK_DISABLED'); };
