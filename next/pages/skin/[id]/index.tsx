import { GetStaticPaths, NextPage } from 'next';
import { useRouter } from 'next/router';
import { Item, Language, Revision, Skin } from '@prisma/client';
import DetailLayout from '../../../components/Layout/DetailLayout';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { db } from '../../../lib/prisma';
import { getStaticSuperProps, withSuperProps } from '../../../lib/superprops';
import rarityClasses from '../../../components/Layout/RarityColor.module.css';
import { getIconUrl } from '../../../components/Item/ItemIcon';
import { Headline } from '../../../components/Headline/Headline';
import { Rarity } from '../../../components/Item/Rarity';
import { Gw2Api } from 'gw2-api-types';
import { ItemTable } from '../../../components/Item/ItemTable';
import { WithIcon } from '../../../lib/with';

export interface SkinPageProps {
  skin: WithIcon<Skin> & {
    unlockedByItems: WithIcon<Item>[]
  };
  revision: Revision;
}

const SkinPage: NextPage<SkinPageProps> = ({ skin, revision }) => {
  const router = useRouter();

  if(!skin) {
    return <DetailLayout title={<Skeleton/>} breadcrumb={<Skeleton/>}><Skeleton/></DetailLayout>;
  }

  const data: Gw2Api.Skin = JSON.parse(revision.data);

  return (
    <DetailLayout title={data.name} icon={skin.icon && getIconUrl(skin.icon, 64) || undefined} className={rarityClasses[data.rarity]} breadcrumb={`Skin › ${skin.type}${skin.subtype ? ` › ${skin.subtype}` : ''}${skin.weight ? ` › ${skin.weight}` : ''}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div><Rarity rarity={data.rarity}/></div>
        <div>{data.details?.type}</div>
        <div>{data.details?.weight_class}</div>
      </div>

      <Headline id="items">Unlocked by</Headline>
      <ItemTable items={skin.unlockedByItems}/>
    </DetailLayout>
  );
};

export const getStaticProps = getStaticSuperProps<SkinPageProps>(async ({ params, locale }) => {
  const id: number = Number(params!.id!.toString())!;
  const language = (locale ?? 'en') as Language;

  const [skin, revision] = await Promise.all([
    db.skin.findUnique({
      where: { id },
      include: {
        icon: true,
        unlockedByItems: { include: { icon: true }}
      }
    }),
    db.revision.findFirst({ where: { [`currentSkin_${language}`]: { id }}})
  ]);

  if(!skin || !revision) {
    return {
      notFound: true
    };
  }

  return {
    props: { skin, revision },
    revalidate: 600 /* 10 minutes */
  };
});

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [],
    fallback: true,
  };
};

export default withSuperProps(SkinPage);
