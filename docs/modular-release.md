# Modular release scope and workflow

This is the implementation contract for [tracker #18](https://github.com/yasingedik/cleanedin/issues/18)
and [architecture issue #19](https://github.com/yasingedik/cleanedin/issues/19).
Read it with the [architecture](architecture.md). The target release number is
chosen in #36 from the then-current version; this document does not bump 0.1.11.

## Development and integration

- Long-lived integration branch: `develop/modular-extension`, created from
  `99ce53374de3c32702b8f45ded220fe3925e159d`.
- Each issue gets a short-lived branch from the integration branch and a PR
  targeting `develop/modular-extension`. The first is
  `docs/19-modular-architecture`.
- Complete issues #19 through #36 in order. Merge a prerequisite's reviewed PR
  into the integration branch before starting its dependent issue.
- Each PR links its issue, acceptance evidence, relevant checks, and deliberate
  behavior changes. Keep the branch working after each merge.
- Do not merge individual issue PRs into `main`. Handle any necessary updates
  from `main` through a reviewed integration change.
- Once implementation and release-candidate validation are complete, prepare one
  final PR from `develop/modular-extension` to `main` for user review. Store
  submission/publication follows the approved final merge through #36.
- Do not run release scripts or push release tags for intermediate issue work:
  the existing release flow can trigger store packaging/publication.
- Issue #36 spans candidate preparation and actual publication. Tracker #18 and
  #36 stay open during store review even after the engineering work is merged.
- PRs against a non-default branch must explicitly link their issue. After each
  integration merge and acceptance review, update/close the completed issue;
  do not rely on default-branch auto-close keywords to advance the dependency chain.

This workflow takes precedence over the general branch-from-main guidance for
this release. It implements the user's instruction to keep the whole refactor
off `main` until the new version is ready.

## Browser and platform targets

These are selected product compatibility floors for the upcoming release, not
claims that new browser support exists today or that the vendors still support
every older version. Later implementation must avoid newer APIs without a tested
fallback. A release cannot claim a floor that was not validated; if tooling or
platform requirements force a higher floor, amend this contract in a reviewed PR
before publishing.

| Target | Minimum selected for this release | Background target | Validation owner |
| --- | --- | --- | --- |
| Chrome desktop | Chrome 128 | MV3 service worker | #21 and #35 |
| Edge desktop | Edge 128 | MV3 service worker | #21 and #35 |
| Firefox desktop | Firefox 128 | MV3 nonpersistent background scripts/event page | #32 |
| Safari macOS | Safari 18 on macOS 15 | MV3 nonpersistent background scripts/event page | #33 |
| Safari iPhone | Safari on iOS 18 | Same shared Safari target, verified on device | #34 |
| Safari iPad | Safari on iPadOS 18 | Same shared Safari target, verified on device | #34 |

Test the selected minimum and current stable for each target; include the current
Firefox ESR in release validation. Record exact OS/browser versions and use
sanitized local fixtures for older-version compatibility checks. Current
authenticated LinkedIn smoke checks use current supported browsers. Other
Chromium desktop browsers may work but are not declared supported until tested.
Chrome/Firefox on iOS, Firefox Android, non-Safari WebKit hosts, and a native
mobile companion are outside this release.

The floors are conservative project choices, not vendor-mandated minima. The
following platform constraints were checked on September 9, 2026:

- Chrome MV3 uses service workers. Firefox supports nonpersistent background
  scripts rather than `background.service_worker`. Safari supports scripts
  and workers; this release chooses an event-page baseline to share the
  restart-safe handler model with Firefox.
  [MDN background compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- Firefox 127 introduced install-prompt display of host permissions from
  `host_permissions` and `content_scripts`; the selected Firefox 128 floor is
  above that change. Site access can still be revoked and must be tested.
  [MDN host permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions)
- WXT currently defaults Firefox and Safari targets to MV2, so the build must
  explicitly select MV3 and verify generated manifests. Keep transpilation
  targets aligned with this table.
  [WXT browser targets](https://wxt.dev/guide/essentials/target-different-browsers.html)
- Safari requires Apple packaging and distribution. Apple documents both Xcode
  conversion and an App Store Connect Web Extension Packager. Select and verify
  the actual route in #33; do not assume a Mac/Xcode-only packaging requirement.
  [Apple Safari extensions](https://developer.apple.com/safari/extensions/)

Build-time Node 24 is independent of end-user browser versions. Browser/API
availability and Apple build/upload requirements must be rechecked at release;
neither WXT types nor a successful build establishes installed-extension support.

## Behavior that must be preserved

The source of truth is the inspected 0.1.11 implementation at the baseline in
[architecture.md](architecture.md#verified-baseline), including schema 6 and
legacy migrations. #20 converts this contract into characterization fixtures.

| Behavior | Frozen contract |
| --- | --- |
| Categories | Preserve `ad`, `suggested`, `recommendation`, `liked`, `loved`, `supported`, `celebrated`, `funny`, `insightful`, `commented`, `followed`, `shared`, `video`, `poll`, `image`, `link`, and `carousel`; a post can have multiple labels. |
| Category actions | Any matching enabled hide condition can hide a post. A category set to Show does not override another hide condition. |
| Include keywords | When active and nonempty, hide a post if none of the keywords occur. This is an any-keyword inclusion test, not an all-keywords requirement. |
| Exclude keywords | When active and nonempty, hide a post if any keyword occurs. Matching uses normalized, case-insensitive literal substrings, not executable patterns or regex input. |
| Hidden names | Preserve normalized actor-name matching and whole normalized name matching in lead text or the first 520 characters of extracted text. Author-only matching is expressly excluded. |
| Relationships | Preserve following, first, second, third-plus actions and individual/group/company/other profile actions. Missing facts do not automatically satisfy a hide predicate. |
| Age | With a valid active limit and known age, hide only when age exceeds the maximum days. Equality does not hide; unknown age does not satisfy the age predicate. |
| Disable | Disabling filtering makes decisions visible and reverses extension hiding without changing the page's unrelated state. |
| Defaults | Enabled; ads hidden; all other categories, relationship and profile actions shown; hidden badges and in-feed panel enabled; keyword/name/age filters off with empty lists/no age limit; debug off. |
| Explanation priority | Category first, then include miss, exclude hit, hidden name, connection level, profile type, age. Among categories preserve classifier registry order, including priority sorting and tie order. Initially show the same primary explanation even when all reasons become available internally. |
| Show once | Reveal is temporary in the current route, survives ordinary reevaluation, and is cleared by route reset/reload. Handle fallback identity collisions conservatively. |
| Settings and UI | Preserve stored values, schema/legacy migration support, import/export meaning, private local keyword/name lists, section persistence, and optional desktop in-feed controls. Adapt layout for touch/narrow screens without dropping common filters. |
| Privacy and scope | Process rendered LinkedIn content locally; no backend classifier, LinkedIn credentials, developer feed telemetry, or new broad browsing access. Browser-managed optional sync is distinct from developer data collection. |

## Deliberate changes in this release

The product's established filter semantics above stay fixed. These reliability,
architecture, and supported-platform changes are intentional:

1. Replace dynamic module/source/Blob startup with direct packaged injection (#21).
2. Make unavailable durable storage and failed writes explicit; remove silent
   production memory fallback. Preserve preferences while moving panel geometry
   into extension local storage and preventing lost concurrent edits (#22-#24).
3. Separate DOM handles from facts and retain all decision reasons internally,
   preserving the primary explanation shown to users (#25-#26).
4. Fix duplicate effects, stale reveals, page-world SPA navigation, text/attribute
   updates, recycled nodes, root replacement, time progression and disposal
   (#27-#29). Route recognition must deliberately identify feed surfaces rather
   than accidentally match unrelated paths such as `/feedback`.
5. Distinguish unsupported markup from known posts without category matches.
   Keep uncertain structures visible unless an independent reliable filter
   applies; any changed known-fixture decision needs an explicit regression
   explanation. Add bounded, sanitized local diagnostics (#30).
6. Share settings controls with host-specific layout and add validated Firefox
   desktop and Safari desktop/mobile support (#31-#34).
7. Build reproducible browser artifacts and prove upgrade/distribution behavior
   before declaring the release complete (#35-#36).

New filter categories, author-only name semantics, remote classifiers, generic
runtime plugin loading, account-based cross-browser synchronization, and a mobile
companion are excluded. Do not silently expand scope while moving modules.

## Existing distribution identity

These public listing IDs were read from [the committed landing page](cleanedin/index.html).
They are not credentials.

| Product | Public listing ID | Listing |
| --- | --- | --- |
| Chrome | `bkehbcmkfalhkfofndlcnpnjdefdgjjp` | [Chrome Web Store](https://chromewebstore.google.com/detail/cleanedin-feed-filter/bkehbcmkfalhkfofndlcnpnjdefdgjjp) |
| Edge | `ghahgjdkejpbbdomfmbbikcdejlpnomf` | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/cleanedin-feed-filter/ghahgjdkejpbbdomfmbbikcdejlpnomf) |

Preserve the existing store products/signing identity and verify in-place upgrades
with persisted settings. The Edge public listing ID is not necessarily the
publisher API product identifier; do not substitute it for release configuration.
Secrets, tokens, certificates and signing material stay outside documentation.
Firefox/Safari distribution identities are new and must be established in their
platform issues, not invented here.

## Ordered implementation

| Order | Issue | Prerequisite |
| --- | --- | --- |
| 01 | [#19 Architecture and scope](https://github.com/yasingedik/cleanedin/issues/19) | None |
| 02 | [#20 Baseline fixtures and security CI](https://github.com/yasingedik/cleanedin/issues/20) | #19 |
| 03 | [#21 WXT and static injection](https://github.com/yasingedik/cleanedin/issues/21) | #20 |
| 04 | [#22 Platform contracts](https://github.com/yasingedik/cleanedin/issues/22) | #21 |
| 05 | [#23 Settings repository and migration](https://github.com/yasingedik/cleanedin/issues/23) | #22 |
| 06 | [#24 Concurrent settings patches](https://github.com/yasingedik/cleanedin/issues/24) | #23 |
| 07 | [#25 Pure filtering core](https://github.com/yasingedik/cleanedin/issues/25) | #24 |
| 08 | [#26 LinkedIn DOM and semantics](https://github.com/yasingedik/cleanedin/issues/26) | #25 |
| 09 | [#27 Post rendering and reveal](https://github.com/yasingedik/cleanedin/issues/27) | #26 |
| 10 | [#28 SPA lifecycle](https://github.com/yasingedik/cleanedin/issues/28) | #27 |
| 11 | [#29 Mutation handling and caching](https://github.com/yasingedik/cleanedin/issues/29) | #28 |
| 12 | [#30 Diagnostics and uncertainty](https://github.com/yasingedik/cleanedin/issues/30) | #29 |
| 13 | [#31 Shared settings UI](https://github.com/yasingedik/cleanedin/issues/31) | #30 |
| 14 | [#32 Firefox desktop](https://github.com/yasingedik/cleanedin/issues/32) | #31 |
| 15 | [#33 Safari macOS](https://github.com/yasingedik/cleanedin/issues/33) | #32 |
| 16 | [#34 Safari iPhone/iPad](https://github.com/yasingedik/cleanedin/issues/34) | #33 |
| 17 | [#35 Artifacts and validation matrix](https://github.com/yasingedik/cleanedin/issues/35) | #34 |
| 18 | [#36 Candidate, final merge and publication](https://github.com/yasingedik/cleanedin/issues/36) | #35 |

## Completion and release gates

Before opening the final integration PR to `main`:

- [ ] Every implementation issue has a reviewed, merged PR into the integration
  branch and evidence for its acceptance criteria; #36 has completed candidate
  preparation and remains open for distribution.
- [ ] Pure core, semantic, DOM fixture, security and platform contract suites pass.
  The baseline commands omit `tests/security`; #20 must fix selection.
- [ ] Real installed-extension checks cover Chromium, Firefox and Safari, including
  Safari iPhone/iPad, with the minimum/current versions recorded.
- [ ] Current LinkedIn smoke checks and sanitized variant fixtures pass; API
  integration and page compatibility are reported separately.
- [ ] Existing-install upgrades preserve settings, store identity and import/export.
  Storage errors, background restart, concurrent controls and site-access changes
  have been exercised.
- [ ] Performance comparison uses the same baseline scenarios; unexplained
  regressions, stale roots, runaway queues and private diagnostic output are resolved.
- [ ] All browser candidate artifacts identify the same tested source revision,
  with generated manifests, resource paths and checksums verified.
- [ ] Release notes, support matrix, architecture, installation instructions,
  migrations and rollback plan match the candidate.

After the approved final merge:

- [ ] Record the exact release source revision. If integration or versioning changes
  it, build and validate that actual revision; never relabel an older artifact as
  tested against a newer commit.
- [ ] Publish jobs consume those exact tested artifacts through the established
  release process. Do not rebuild unrelated source during publication.
- [ ] Store submissions and availability are verified for Chrome, Edge, Firefox and
  Safari. Pending external review remains a visible blocker on #36.
- [ ] Tracker #18 links the shipped version, commit, artifacts, test matrix and
  store listings before it is closed.

Unavailable device, signing or store access is an explicit blocker, not a waived
test. Playwright's Chromium installed-extension harness does not validate Firefox
or Safari simply by changing its webpage browser engine. Runtime and store work
belong to the later issues; this documentation PR does not claim those gates pass.
