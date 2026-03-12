/**
 * Ride Aggregate Root
 *
 * Owns the ride lifecycle state machine and all mutation invariants.
 * Enforces transition validity, terminal immutability, and expiration policies.
 *
 * PRD alignment:
 * - No TenantId (isolation via ownership/role/geo at inbound boundary)
 * - Time is deterministic: receives nowUTC as values, never calls system clock
 * - All mutations record domain events via this.record()
 */

import { Result } from "../../../shared/core/result.js";
import { AggregateRoot } from "../../../shared/domain/aggregate_root.js";
import type { Location } from "../../../shared/domain/value-objects/location.js";
import {
  ConflictError,
  ValidationError,
} from "../../../shared/errors/error-types.js";
import type { DomainEvent } from "../../../shared/events/domain-event.js";
import type { DriverId } from "../../../shared/types/ids/driver-id.js";
import type { MarketId } from "../../../shared/types/ids/market-id.js";
import type { RideId } from "../../../shared/types/ids/ride-id.js";
import type { RiderId } from "../../../shared/types/ids/rider-id.js";
import {
  createRideCreatedEvent,
  createRideStateChangedEvent,
} from "./events.js";
import {
  addSecondsToIsoUtc,
  type ChangedByRole,
  canTransition,
  expirationPolicySeconds,
  isAfter,
  isTerminalState,
  RIDE_STATES,
  type RideState,
} from "./ride-states.js";

/**
 * Properties for creating a new Ride
 */
export interface CreateRideProps {
  id: RideId;
  riderId: RiderId;
  pickup: Location;
  dropoff: Location;
  nowUTC: string;
  marketId?: MarketId | null;
}

/**
 * Properties for reconstituting a Ride from persistence
 */
export interface ReconstitutedRideProps {
  id: RideId;
  riderId: RiderId;
  driverId: DriverId | null;
  marketId: MarketId | null;
  state: RideState;
  pickup: Location;
  dropoff: Location;
  requestedAtUTC: string;
  startedAtUTC: string | null;
  completedAtUTC: string | null;
  expiresAtUTC: string | null;
  version: number;
}

/**
 * Parameters for ride state transition
 */
export interface TransitionParams {
  toState: RideState;
  changedBy: string;
  changedByRole: ChangedByRole;
  reason?: string;
  driverId?: DriverId;
  nowUTC: string;
}

/**
 * Ride Aggregate Root
 */
export class Ride extends AggregateRoot {
  private constructor(
    private readonly _id: RideId,
    private _riderId: RiderId,
    private _driverId: DriverId | null,
    private _marketId: MarketId | null,
    private _state: RideState,
    private _pickup: Location,
    private _dropoff: Location,
    private _requestedAtUTC: string,
    private _startedAtUTC: string | null,
    private _completedAtUTC: string | null,
    private _expiresAtUTC: string | null
  ) {
    super();
  }

  /**
   * Static factory: Create a new Ride
   *
   * Initial state: CREATED
   * Records RideCreated event
   */
  static create(props: CreateRideProps): Ride {
    const ride = new Ride(
      props.id,
      props.riderId,
      null, // driverId
      props.marketId ?? null,
      RIDE_STATES.CREATED,
      props.pickup,
      props.dropoff,
      props.nowUTC,
      null, // startedAtUTC
      null, // completedAtUTC
      null // expiresAtUTC
    );

    // Record domain event
    ride.record(
      createRideCreatedEvent(props.id, {
        rideId: props.id,
        riderId: props.riderId,
        pickup: {
          lat: props.pickup.latitude,
          lng: props.pickup.longitude,
        },
        dropoff: {
          lat: props.dropoff.latitude,
          lng: props.dropoff.longitude,
        },
        requestedAtUTC: props.nowUTC,
        marketId: props.marketId ?? undefined,
      })
    );

    return ride;
  }

  /**
   * Static factory: Reconstitute from persistence
   *
   * MUST NOT record events
   * MUST NOT perform I/O or call system clock
   */
  static reconstitute(props: ReconstitutedRideProps): Ride {
    const ride = new Ride(
      props.id,
      props.riderId,
      props.driverId,
      props.marketId,
      props.state,
      props.pickup,
      props.dropoff,
      props.requestedAtUTC,
      props.startedAtUTC,
      props.completedAtUTC,
      props.expiresAtUTC
    );

    // Restore version from persistence
    ride.version = props.version;

    return ride;
  }

  /**
   * Transition to a new state
   *
   * Enforces:
   * - Terminal immutability (cannot transition from terminal states)
   * - Valid transitions only (per state machine)
   * - Expiration policy (DISPATCHING: 120s, ASSIGNED: 300s)
   * - Timestamp side-effects based on target state
   * - Driver assignment for ASSIGNED state
   *
   * Records RideStateChanged event on success
   */
  transition(
    params: TransitionParams
  ): Result<void, ConflictError | ValidationError> {
    // Guard: Cannot transition from terminal state
    if (isTerminalState(this._state)) {
      return Result.err(
        new ConflictError("Ride is in terminal state", {
          currentState: this._state,
          attemptedAction: `transition to ${params.toState}`,
        })
      );
    }

    // Guard: Validate transition is allowed
    if (!canTransition(this._state, params.toState)) {
      return Result.err(
        new ConflictError("Invalid state transition", {
          currentState: this._state,
          attemptedAction: `transition to ${params.toState}`,
        })
      );
    }

    // Guard: ASSIGNED requires driverId
    if (params.toState === RIDE_STATES.ASSIGNED && !params.driverId) {
      return Result.err(
        new ValidationError("ASSIGNED state requires driverId")
      );
    }

    // Record previous state for event
    const previousState = this._state;

    // Apply state change
    this._state = params.toState;

    // Apply expiration policy
    const expirationSeconds = expirationPolicySeconds(params.toState);
    if (expirationSeconds !== null) {
      this._expiresAtUTC = addSecondsToIsoUtc(params.nowUTC, expirationSeconds);
    }

    // Apply timestamp side-effects based on target state
    if (params.toState === RIDE_STATES.ASSIGNED) {
      // Set driver ID
      this._driverId = params.driverId ?? null;
    } else if (params.toState === RIDE_STATES.STARTED) {
      // Started: set startedAtUTC, clear expiresAtUTC
      this._startedAtUTC = params.nowUTC;
      this._expiresAtUTC = null;
    } else if (
      params.toState === RIDE_STATES.COMPLETED ||
      params.toState === RIDE_STATES.CANCELED ||
      params.toState === RIDE_STATES.EXPIRED ||
      params.toState === RIDE_STATES.FAILED
    ) {
      // Terminal states: set completedAtUTC, clear expiresAtUTC
      this._completedAtUTC = params.nowUTC;
      this._expiresAtUTC = null;
    }

    // Increment version for optimistic locking
    this.version++;

    // Record domain event
    this.record(
      createRideStateChangedEvent(this._id, {
        rideId: this._id,
        previousState,
        newState: this._state,
        changedBy: params.changedBy,
        changedByRole: params.changedByRole,
        reason: params.reason,
        driverId: params.driverId,
      })
    );

    return Result.ok(undefined);
  }

  /**
   * Check if ride is expired at a given time
   *
   * @param nowUTC - ISO UTC timestamp to compare against
   * @returns true if ride has expiresAtUTC and nowUTC is after it
   */
  isExpiredAt(nowUTC: string): boolean {
    if (!this._expiresAtUTC) {
      return false;
    }
    return isAfter(nowUTC, this._expiresAtUTC);
  }

  /**
   * Check if current state is terminal
   */
  get isTerminal(): boolean {
    return isTerminalState(this._state);
  }

  /**
   * Check if transition to a given state is valid from current state
   */
  canTransitionTo(toState: RideState): boolean {
    return canTransition(this._state, toState);
  }

  // Aggregate identity
  get id(): RideId {
    return this._id;
  }

  // Getters
  get riderId(): RiderId {
    return this._riderId;
  }

  get driverId(): DriverId | null {
    return this._driverId;
  }

  get marketId(): MarketId | null {
    return this._marketId;
  }

  get state(): RideState {
    return this._state;
  }

  get pickup(): Location {
    return this._pickup;
  }

  get dropoff(): Location {
    return this._dropoff;
  }

  get requestedAtUTC(): string {
    return this._requestedAtUTC;
  }

  get startedAtUTC(): string | null {
    return this._startedAtUTC;
  }

  get completedAtUTC(): string | null {
    return this._completedAtUTC;
  }

  get expiresAtUTC(): string | null {
    return this._expiresAtUTC;
  }

  /** Current version for optimistic locking (delegates to base). */
  override getVersion(): number {
    return super.getVersion();
  }

  /** Pull recorded domain events and clear (delegates to base). */
  override pullDomainEvents(): DomainEvent[] {
    return super.pullDomainEvents();
  }
}
