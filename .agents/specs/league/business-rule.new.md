> **Source note (2026-09-16):** raw product requirement, kept verbatim below. It is encoded in `plan.league.spec.md` (business rules) and `engine.spec.md` (payment gate). Interpretation locked: day-3 "disable and notify" = **locked** (read-only for every user + highlighted `PaymentGateNotice`, rendered whenever the organizer views the event — no proactive push in v1; Phase-5 email reminders cover day 2/3/6); "disabled definitively 3 days after" = day **6** (`disabled`, payment registration rejected, admin-only revival).

set this business rule:

the events can be created and scheduled max until 2 month in advance.
third day after created an event, if this event don't has a registered payment, it is disable and notify the organizer that, must make a payment for move on, or don't do anything, and this sport-event is desiable definitively 3 days after
if the paymnent is not registed, it don't allow make modifications on the event settings by any user of this sport-event, only is enable make the payment, read-only for the whole features and data.
in addition it must shows a highligh announce which says that the payment is needed to move forward.
