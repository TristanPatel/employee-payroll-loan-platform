'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';

export interface NewVersionState {
  error?: string;
}

export async function createNewVersion(
  templateId: string,
  _prev: NewVersionState | undefined,
  formData: FormData,
): Promise<NewVersionState> {
  await requireMasterAdmin();
  const supabase = await createSupabaseServer();

  const { data: parent, error: parentErr } = await supabase
    .from('contract_templates')
    .select('template_key, name, variables, required_signatories')
    .eq('id', templateId)
    .maybeSingle();
  if (parentErr || !parent) return { error: parentErr?.message ?? 'parent not found' };

  const { data: latest } = await supabase
    .from('contract_templates')
    .select('version')
    .eq('template_key', parent.template_key)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;

  const body = String(formData.get('body_html') ?? '').trim();
  const name = String(formData.get('name') ?? parent.name).trim();
  const publish = formData.get('publish') === 'on';
  if (!body || body.length < 50) {
    return { error: 'body_html is required (minimum 50 characters).' };
  }

  const { data: created, error: insertErr } = await supabase
    .from('contract_templates')
    .insert({
      template_key: parent.template_key,
      version: nextVersion,
      name,
      body_html: body,
      variables: parent.variables,
      required_signatories: parent.required_signatories,
      published_at: publish ? new Date().toISOString() : null,
      effective_from: publish ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (insertErr || !created) return { error: insertErr?.message ?? 'insert failed' };

  revalidatePath('/admin/templates');
  redirect(`/admin/templates/${created.id}`);
}
