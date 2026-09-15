// Shared vocabulary; legacy saves remain readable during the upgrade.
export const RECONSTRUCTION_STATUS = Object.freeze({
    COMPLETE: "COMPLETE", PREPARING: "PREPARING", REBUILDING: "REBUILDING",
    VERIFYING: "VERIFYING", COMMITTING: "COMMITTING",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED", RECOVERING: "RECOVERING",
});
export function normalizeReconstructionStatus(status) {
    if (status === "complete") return "COMPLETE";
    if (["dynamic_rebuilding", "building", "clearing"].includes(status)) return "REBUILDING";
    if (["dynamic_recovering", "dynamic_recovery_sync", "dynamic_recovered"].includes(status)) return "RECOVERY_REQUIRED";
    return status;
}
export function needsReconstructionRecovery(status) {
    return ["PREPARING", "REBUILDING", "VERIFYING", "COMMITTING", "RECOVERY_REQUIRED", "RECOVERING"]
        .includes(normalizeReconstructionStatus(status));
}

// Only the reconstruction owner invokes these callbacks. A failed activation
// also returns to recovery; COMPLETE alone cannot retire the rollback journal.
export async function commitRecoveredPlan(plan, api) {
    try {
        await api.saveDetailedPlan(plan);
        await api.saveState("COMPLETE", [plan]);
        await api.activateSource(plan);
        await api.activateEncounters(plan);
        await api.finish();
    } catch (error) {
        await api.saveState("RECOVERY_REQUIRED", [plan]);
        throw error;
    }
}
