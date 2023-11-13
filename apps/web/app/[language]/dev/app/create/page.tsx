import { PageLayout } from '@/components/Layout/PageLayout';
import { Button } from '@gw2treasures/ui/components/Form/Button';
import { Label } from '@gw2treasures/ui/components/Form/Label';
import { TextInput } from '@gw2treasures/ui/components/Form/TextInput';
import { Headline } from '@gw2treasures/ui/components/Headline/Headline';
import { db } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/getUser';
import { Notice } from '@gw2treasures/ui/components/Notice/Notice';
import Link from 'next/link';
import { FlexRow } from '@gw2treasures/ui/components/Layout/FlexRow';

async function createApplication(data: FormData) {
  'use server';

  const name = data.get('name');

  if(typeof name !== 'string') {
    redirect('/dev/app/create?error');
  }

  const user = await getUser();

  if(!user) {
    redirect('/login');
  }

  const application = await db.application.create({
    data: {
      name,
      apiKey: crypto.randomUUID(),
      ownerId: user.id,
    }
  });

  redirect(`/dev/app/${application.id}`);
}

export default async function DevAppCreatePage() {
  const user = await getUser();

  return (
    <PageLayout>
      <Headline id="create">Create Application</Headline>
      {!user && (
        <Notice type="warning">You need to <Link href="/login">Login</Link> to create applications.</Notice>
      )}

      <p>
        You can create applications to access gw2treasures.com APIs.
      </p>

      {user && (
        <form action={createApplication}>
          <Label label="Name">
            <TextInput name="name"/>
          </Label>

          <FlexRow>
            <Button type="submit">Create Application</Button>
          </FlexRow>
        </form>
      )}
    </PageLayout>
  );
}
