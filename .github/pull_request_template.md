<!--
Thanks for sending a pull request. Please fill in the sections below so the
change is easy to review. For non-trivial changes, please link the issue you
discussed before writing code.
-->

## Summary

<!-- One or two sentences: what changes, and why. -->

## Related issue

<!-- Closes #123, or "n/a" for small fixes. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor or cleanup
- [ ] Documentation
- [ ] Tests
- [ ] CI / build

## Platforms affected

- [ ] Windows
- [ ] macOS
- [ ] Linux
- [ ] Cross-platform (no OS-specific code)

## How this was tested

<!-- Steps you ran to verify the change locally. -->

## Checks

- [ ] `cargo fmt --all -- --check` passes
- [ ] `cargo clippy --all-targets -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `pnpm lint` and `pnpm build` pass (frontend changes)
- [ ] IPC contract kept in sync: changes to `app/src-tauri/src/models.rs` are mirrored in `app/src/lib/types.ts` (and vice versa)
- [ ] No emoji added anywhere - icons use the lucide-react set
- [ ] No telemetry or off-device data calls introduced

## Screenshots or notes

<!-- For UI changes, attach before/after screenshots in dark and light themes. -->
