import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { NewVersionForm } from './new-version-form';

export const dynamic = 'force-dynamic';

export default async function NewVersionPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: parent } = await supabase
    .from('contract_templates')
    .select('id, template_key, version, name, body_html, required_signatories')
    .eq('id', params.id)
    .maybeSingle();
  if (!parent) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/admin/templates/${parent.id}`}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to template
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          {parent.template_key} · forking from v{parent.version}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-base">New template version</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Edit the HTML body, then publish to make it immutable. Contracts already issued
          under v{parent.version} keep their template-version snapshot.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Body HTML</CardTitle>
          <CardDescription>
            Use{' '}
            <code className="text-xs">&#123;&#123;variable_name&#125;&#125;</code> for
            template fields. Required signatories carry over from the parent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewVersionForm templateId={parent.id} parentName={parent.name} parentBody={parent.body_html} />
        </CardContent>
        <CardFooter>
          <p className="text-xs text-ink-muted">
            Required signatories ({(parent.required_signatories ?? []).join(', ')}) and
            variable bindings inherit from the parent.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
