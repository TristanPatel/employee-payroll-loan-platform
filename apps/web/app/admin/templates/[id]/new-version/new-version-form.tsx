'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createNewVersion, type NewVersionState } from './actions';

export function NewVersionForm({
  templateId,
  parentName,
  parentBody,
}: {
  templateId: string;
  parentName: string;
  parentBody: string;
}): React.ReactElement {
  const [state, action] = useFormState<NewVersionState, FormData>(
    (prev, fd) => createNewVersion(templateId, prev, fd),
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name" required>
          Version name
        </Label>
        <Input id="name" name="name" defaultValue={parentName} required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="body_html" required>
          Body HTML
        </Label>
        <Textarea
          id="body_html"
          name="body_html"
          defaultValue={parentBody}
          required
          rows={24}
          className="mt-1 font-mono text-xs"
        />
        <FieldHelp>
          Sections (consent, parties, schedule, default, governance) should match the
          structure of the parent. Rendering uses dangerouslySetInnerHTML — keep markup
          conservative.
        </FieldHelp>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="publish"
          name="publish"
          className="h-4 w-4 rounded border-ink-muted/40"
        />
        <Label htmlFor="publish">Publish immediately (immutable after publish)</Label>
      </div>
      <FieldError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Create new version'}
    </Button>
  );
}
