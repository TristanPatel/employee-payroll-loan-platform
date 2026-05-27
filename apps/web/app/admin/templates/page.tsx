import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { formatLusakaDate } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function TemplatesListPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: templates } = await supabase
    .from('contract_templates')
    .select('id, template_key, version, name, published_at, effective_from, required_signatories')
    .is('deleted_at', null)
    .order('template_key', { ascending: true })
    .order('version', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Contract templates</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Read-only list. New-version creation and the rich editor land in Phase 4C.
          Once a template is published it&apos;s immutable — edits create a new version.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {templates && templates.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Key</th>
                  <th className="px-6 py-3 font-medium">Version</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Signatories</th>
                  <th className="px-6 py-3 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3 font-medium text-ink-base">{t.template_key}</td>
                    <td className="px-6 py-3 text-ink-muted">v{t.version}</td>
                    <td className="px-6 py-3 text-ink-base">
                      <Link
                        href={`/admin/templates/${t.id}`}
                        className="hover:text-richmond-primary"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-muted">
                      {(t.required_signatories ?? []).join(', ')}
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-muted">
                      {t.published_at ? formatLusakaDate(t.published_at) : 'Draft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No templates yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
