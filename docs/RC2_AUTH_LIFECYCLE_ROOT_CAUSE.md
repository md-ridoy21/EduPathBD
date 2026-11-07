# RC2 authentication modal root-cause analysis

## Observed evidence

The desktop and mobile Playwright flow both completed the Student demo click but still found `auth-modal-overlay` in the DOM for the full 8-second assertion window. An earlier deterministic-unmount build progressed beyond that point to the Account & privacy assertion, proving the demo session itself could complete and isolating the blocking behavior to the modal lifecycle.

## Root cause

`AuthModal` represented a security/session boundary but was implemented with `AnimatePresence`, allowing the full-screen pointer-blocking overlay to remain mounted while its exit lifecycle completed. In the tested browser/runtime combination this exit presence did not reliably leave the DOM after authentication. Static source checks only verified `open={authOpen && !session}` and therefore missed the actual DOM-lifecycle invariant.

## Corrective design

Authentication closure is now deterministic and redundant by design:

1. `handleAuthenticated` closes auth state before committing the session.
2. A session-state effect closes any stale auth state.
3. `AuthModal` returns `null` immediately when `open` is false.
4. The app still passes `authOpen && !session`, preventing an authenticated shell from requesting the modal.
5. Operations and release verification reject any future `AnimatePresence`-based auth overlay regression.

Entry animation remains; only the exit animation is removed from the authentication overlay because correctness, focus safety, and pointer release take precedence over decorative exit motion at an authentication boundary.

## Separate accessibility issue

The Account & privacy dialog accessible-name mismatch is independently fixed: its visible bilingual purpose label owns `aria-labelledby`, while the student's display name remains content.
