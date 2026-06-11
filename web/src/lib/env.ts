/* Deployment-aware flags read at build time. The launcher sets
 * GEOFFERY_DEPLOYMENT_NAME; astro.config.mjs injects it into
 * import.meta.env.PUBLIC_GEOFFERY_DEPLOYMENT_NAME so templates can flip
 * posture without each component re-reading process.env.
 */

export type DeploymentName = 'local' | 'qa' | 'prod';

const raw = (import.meta.env.PUBLIC_GEOFFERY_DEPLOYMENT_NAME ?? 'local') as string;
export const deployment: DeploymentName =
  raw === 'qa' || raw === 'prod' ? raw : 'local';

export const isProd = deployment === 'prod';
export const isQa = deployment === 'qa';
export const isLocal = deployment === 'local';

// noindex on anything that isn't the public production site. qa is hidden
// at the CF Access layer; the meta tag is the second line of defence for
// the rare crawler that gets past Access. Local builds are obviously not
// indexable but we tag them anyway for posture consistency.
export const robotsContent = isProd ? 'index, follow' : 'noindex, nofollow';

export const buildVersion =
  (import.meta.env.PUBLIC_GEOFFERY_BUILD_VERSION as string | undefined) ?? 'unbuilt';
