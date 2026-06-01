/** ACRCloud identify API max sample size. */
export const ACR_MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

/** Minimum bytes for a valid WebM/fingerprint sample (client + worker). */
export const MIN_IDENTIFY_SAMPLE_BYTES = 4096;

/** Client may POST up to this; worker trims to {@link ACR_MAX_SAMPLE_BYTES} for ACR. */
export const MAX_IDENTIFY_UPLOAD_BYTES = 12 * 1024 * 1024;
