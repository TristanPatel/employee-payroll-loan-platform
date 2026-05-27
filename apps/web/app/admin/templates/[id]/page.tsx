import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLusakaDate } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function TemplateDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/templates"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to templates
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{template.template_key} · v{template.version}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-base">{template.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {template.published_at
            ? `Published ${formatLusakaDate(template.published_at)} · immutable`
            : 'Draft — editable until published'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Required signatories and the variable bindings.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Signatories</dt>
            <dd className="text-right text-ink-base">{(template.required_signatories ?? []).join(', ')}</dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Effective from</dt>
            <dd className="text-right text-ink-base">
              {template.effective_from ? formatLusakaDate(template.effective_from) : '—'}
            </dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Variables</dt>
            <dd className="text-right text-xs text-ink-muted">
              {Object.keys((template.variables as Record<string, unknown>) ?? {}).length} fields
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body</CardTitle>
          <CardDescription>HTML source rendered into PDFs at signing time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none rounded-md border border-ink-muted/10 bg-white p-4 text-ink-base"
            dangerouslySetInnerHTML={{ __html: template.body_html }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
