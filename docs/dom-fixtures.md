# DOM Fixture Notes

This repository includes starter feed fixtures in `tests/fixtures/feed/` used to validate classifier behavior.

Initial coverage implemented:
- `ad-positive.html`
- `video-positive.html`
- `link-positive.html`
- `unknown-negative.html`

Expand this dataset with sanitized examples from supported LinkedIn layouts.
Keep private captures in ignored local directories; never commit account data.

## Behavior baseline

The [issue #20 baseline](baselines/issue20/README.md) documents synthetic category
and DOM fixtures, filter outcomes, known gaps, installed-extension tests and
repeatable performance workloads. Run `npm run test:fixtures` to execute the
characterization suite, and `npm run test:baseline` to record component timings.
