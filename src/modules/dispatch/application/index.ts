/**
 * Dispatch Application Module
 *
 * Exports all application-layer components for the dispatch bounded context.
 */

// Process Manager
export {
  DispatchProcessManager,
  type DispatchResultDTO,
  type DispatchRideParams,
} from "./dispatch.process-manager.js";
// Integration Events
export type {
  DispatchCompletedV1,
  DispatchCompletedV1Payload,
  DispatchFailedV1,
  DispatchFailedV1Payload,
  IntegrationEvent,
  IntegrationEventEnvelope,
} from "./events/integration-events.js";
export { mapDispatchDomainEvents } from "./events/integration-events.js";
export type {
  DispatchAuditRecord,
  DispatchAuditWriter,
  DispatchOutcome,
  EvaluatedCandidate,
  SearchCenter,
} from "./ports/dispatch-audit-writer.port.js";
export type {
  CreateIfAbsentParams,
  DispatchProcessState,
  DispatchProcessStatus,
  DispatchProcessStore,
  GetByCorrelationIdParams,
  MarkFailedParams,
  MarkSucceededParams,
} from "./ports/dispatch-process-store.port.js";
// Ports
export type {
  RideAssignmentPort,
  TransitionRideToAssignedParams,
} from "./ports/ride-assignment.port.js";
