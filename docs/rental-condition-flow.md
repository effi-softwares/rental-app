# Rental Condition Flow

## Summary

Vehicle condition is now handled as part of the rental lifecycle in two places:

- Handover: start-of-rental readings are captured in the guided handover flow, with optional condition evidence when staff marks that the vehicle condition changed since the last rental.
- Return: required before a rental can be completed.

## Rules

- Handover captures the minimum start-of-rental record before activation.
- Handover condition evidence is optional.
- Handover condition evidence requires:
  - a condition rating
  - at least one photo or video proof
- Handover updates the vehicle's latest condition baseline only when staff explicitly marks the condition as changed.
- Return condition update is required.
- Return condition update requires:
  - a condition rating
  - at least one photo or video proof
- Return always updates the vehicle's latest condition baseline.
- Rental completion is blocked until the required return condition evidence exists.

## Data model

- `rental_inspection.condition_rating` stores the inspection-time rating history.
- `vehicle.latest_condition_snapshot` stores the current vehicle baseline used by future rentals.

## UI behavior

- The New Rental drawer no longer captures vehicle condition at rental creation.
- The rental details handover panel now routes staff into a dedicated full-screen handover flow.
- The guided handover drawer records odometer and other readings, supports optional condition proof, and saves the required start-of-rental inspection before activation.
- The guided return drawer requires a condition rating before staff can continue and requires at least one proof file before the inspection can be saved.
- The rentals list no longer completes returns directly; return always opens the guided return flow.

## Compatibility

- No legacy backfill or backward compatibility behavior is required.
- Older rentals and vehicles may have null condition fields until they are updated by a new pickup or return workflow.