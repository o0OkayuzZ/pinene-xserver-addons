# Idle castle recovery notice fix

## Trigger and behavior

A Creative/Spectator observer does not count as a survival encounter participant.
After the existing 60-second absence grace, the run enters
`ENDED_PENDING_REBUILD`; its encounter runtime intentionally stays unready.
Previously the ready watchdog interpreted this normal idle state as a failure
and repeatedly displayed `無限城を復旧中です…`. Its recovery callback was gated
on an active run, so no recovery could finish this apparent wait. Reloading an
already-ended run reproduced the same display.

The watchdog now requires an active run, a real pending recovery, or an owned
job in progress before starting its timer. An intentionally idle runtime clears
the timer. Actual pending recovery still notifies and invokes the recovery owner
even when the encounter run has ended. No saved castle, reward, or player state
is cleared to dismiss the message.

## Validation

`npm run test:castle`: 113 passed. Added runtime regressions cover Creative-only
expiry and process reload, real recovery during an ended run, and clearing stale
watchdog timers. Existing active-run recovery timing and returning-participant
tests remain enabled.

All configured deployment targets receive the fix, with Aurealis using the
updated shared castle pack. Embedded/server BP version: `0.2.12`; shared UUID
and version references are preserved. See
[rollout evidence](idle-recovery-notice-evidence.json). Minecraft must reload the
scripts through a restart; automated tests do not establish live client behavior.
