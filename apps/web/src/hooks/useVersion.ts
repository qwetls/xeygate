import { APP_VERSION } from "@srouter/constants";

export const CURRENT_VERSION = `v${APP_VERSION}`;

export interface VersionInfo {
    currentVersion: string;
}

/**
 * The deployed version, straight from the build. No remote update channel:
 * this instance ships through the platform's own release pipeline, so the UI
 * never points at an upstream source repository.
 */
export function useVersion(): VersionInfo {
    return { currentVersion: CURRENT_VERSION };
}
