# Security boundary

The public site is a static, model-free reference lab on synthetic data. It has no provider credentials, accounts, authenticated archive service, remote tool dispatch or model-internals access. The in-memory archive's scope callback demonstrates explicit ownership filtering; it does not authenticate human users or confine subprocesses.

Do not place real conversations, credentials, identifiers or controlled fixtures into publication assets. Original documents and the separately licensed runtime remain outside this checkout. Native proposal outputs are untrusted until their declared checks pass. File hashing establishes integrity, not publisher authenticity.

Report reproducible defects through the repository issue tracker after publication. Include a public synthetic reproduction, never a secret or private history.
