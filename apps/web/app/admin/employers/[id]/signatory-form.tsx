'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { addSignatory, type FormState } from '../actions';

export function SignatoryForm({ employerId }: { employerId: string }): React.ReactElement {
  const [state, action] = useFormState<FormState, FormData>(
    (prev, fd) => addSignatory(employerId, prev, fd),
    {},
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div>
        <Label htmlFor="full_name" required>Full name</Label>
        <Input id="full_name" name="full_name" required className="mt-1" />
        <FieldError message={state.fieldErrors?.full_name} />
      </div>
      <div>
        <Label htmlFor="position" required>Position</Label>
        <Input id="position" name="position" required className="mt-1" placeholder="HR Manager" />
        <FieldError message={state.fieldErrors?.position} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" className="mt-1" />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" className="mt-1" />
      </div>
      <div className="sm:col-span-4 flex items-center justify-between">
        <FieldError message={state.error} />
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Adding…' : 'Add signatory'}
    </Button>
  );
}
