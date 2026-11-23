import { getProviderConfig } from '../../../lib/ai/provider';
import { accessKeyRequired } from '../../../lib/security';

export const dynamic = 'force-dynamic';

/** Tells the browser what is available — never the keys themselves. */
export function GET() {
  const provider = getProviderConfig();
  return Response.json(
    {
      aiConfigured: Boolean(provider),
      provider: provider?.name ?? null,
      model: provider?.model ?? null,
      accessKeyRequired: accessKeyRequired(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
