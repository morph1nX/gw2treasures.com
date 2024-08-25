/* eslint-disable @next/next/no-img-element */
import { Trans } from '@/components/I18n/Trans';
import { HeroLayout } from '@/components/Layout/HeroLayout';
import { Headline } from '@gw2treasures/ui/components/Headline/Headline';
import homeNodes from '@gw2efficiency/game-data/home/nodes';
import homeCats from '@gw2efficiency/game-data/home/cats';
import { createDataTable } from '@gw2treasures/ui/components/Table/DataTable';
import { linkProperties } from '@/lib/linkProperties';
import { db } from '@/lib/prisma';
import { ItemLink } from '@/components/Item/ItemLink';
import { ColumnSelect } from '@/components/Table/ColumnSelect';
import { parseIcon } from '@/lib/parseIcon';
import { EntityIcon } from '@/components/Entity/EntityIcon';
import { FlexRow } from '@gw2treasures/ui/components/Layout/FlexRow';
import { groupById } from '@gw2treasures/helper/group-by';
import type { FC } from 'react';
import { cache } from '@/lib/cache';
import { Gw2AccountBodyCells, Gw2AccountHeaderCells } from '@/components/Gw2Api/Gw2AccountTableCells';
import { AccountHomeCatCell, AccountHomeNodeCell, AccountHomesteadDecorationCell, AccountHomesteadGlyphsCell, DecorationRowFilter, DecorationTableFilter, DecorationTableProvider, requiredScopes } from './page.client';
import { globalColumnRenderer as itemTableColumn } from '@/components/ItemTable/columns';
import { PageView } from '@/components/PageView/PageView';
import type { Language } from '@gw2treasures/database';
import { EntityIconMissing } from '@/components/Entity/EntityIconMissing';
import { FormatNumber } from '@/components/Format/FormatNumber';
import { localizedName } from '@/lib/localizedName';
import { UnknownItem } from '@/components/Item/UnknownItem';
import { translateMany } from '@/lib/translate';


const getItems = cache(
  async (ids: number[]) => {
    const items = await db.item.findMany({
      where: { id: { in: ids }},
      select: { ...linkProperties, tpTradeable: true, tpCheckedAt: true, buyPrice: true, buyQuantity: true, sellPrice: true, sellQuantity: true }
    });

    return Object.fromEntries(groupById(items).entries());
  }, ['homestead-items'], { revalidate: 60 * 5 }
);

const getDecorations = cache(
  () => db.homesteadDecoration.findMany({
    include: {
      icon: true,
      categories: true,
    }
  }),
  ['homestead-decorations'], { revalidate: 60 }
);

const getDecorationCategories = cache(
  () => db.homesteadDecorationCategory.findMany(),
  ['homestead-decoration-categories'], { revalidate: 60 }
);

const getGlyphs = cache(
  () => db.homesteadGlyph.findMany({
    include: { item: { select: linkProperties }},
    distinct: ['itemIdRaw']
  }),
  ['homestead-glyphs'], { revalidate: 60 }
);

export default async function HomesteadPage({ params: { language }}: { params: { language: Language }}) {
  // get item ids that unlock some node
  const nodeUnlockItemIds = homeNodes.reduce<number[]>(
    (ids, node) => [...ids, ...node.unlock_items],
    []
  );

  // get items from db that unlock some node
  const [unlockItems, decorations, decorationCategories, glyphs] = await Promise.all([
    getItems(nodeUnlockItemIds),
    getDecorations(),
    getDecorationCategories(),
    getGlyphs(),
  ]);

  // add the item to each node
  const nodes = homeNodes.map((node) => ({
    ...node,
    item: unlockItems[node.unlock_items[0]]
  }));

  // create data-tables
  const HomeNode = createDataTable(nodes, ({ id }) => id);
  const HomeCats = createDataTable(homeCats, ({ id }) => id);
  const Decorations = createDataTable(decorations, ({ id }) => id);
  const Glyphs = createDataTable(glyphs, ({ id }) => id);

  const decorationFilterDings = decorationCategories.map((category) => ({
    id: category.id,
    name: localizedName(category, language),
    decorationIndexes: decorations.map(({ categoryIds }, index) => [categoryIds, index] as const)
      .filter(([ categoryIds ]) => categoryIds.includes(category.id))
      .map(([, index]) => index)
  }));

  const glyphSlotTranslations = translateMany(['homestead.glyphs.slot.harvesting', 'homestead.glyphs.slot.logging', 'homestead.glyphs.slot.mining']);

  return (
    <HeroLayout color="#397aa1" hero={<Headline id="homestead"><Trans id="navigation.homestead"/></Headline>} toc>
      <Headline id="nodes" actions={<ColumnSelect table={HomeNode}/>}><Trans id="homestead.nodes"/></Headline>
      <p><Trans id="homestead.nodes.description"/></p>

      <HomeNode.Table>
        <HomeNode.Column id="id" title="Id" small hidden>{({ id }) => id}</HomeNode.Column>
        <HomeNode.Column id="node" title="Node" sortBy="name">{({ item, name }) => item ? <ItemLink item={item}/> : name}</HomeNode.Column>
        <HomeNode.Column id="buyPrice" title="Buy Price" sortBy={({ item }) => item.buyPrice} align="right">{({ item }) => itemTableColumn.buyPrice(item, {})}</HomeNode.Column>
        <HomeNode.Column id="buyQuantity" title="Buy Quantity" sortBy={({ item }) => item.buyQuantity} align="right" hidden>{({ item }) => itemTableColumn.buyQuantity(item, {})}</HomeNode.Column>
        <HomeNode.Column id="sellPrice" title="Sell Price" sortBy={({ item }) => item.sellPrice} align="right" hidden>{({ item }) => itemTableColumn.sellPrice(item, {})}</HomeNode.Column>
        <HomeNode.Column id="sellQuantity" title="Buy Quantity" sortBy={({ item }) => item.sellQuantity} align="right" hidden>{({ item }) => itemTableColumn.sellQuantity(item, {})}</HomeNode.Column>
        <HomeNode.DynamicColumns headers={<Gw2AccountHeaderCells requiredScopes={requiredScopes} small/>}>
          {({ id }) => <Gw2AccountBodyCells requiredScopes={requiredScopes}><AccountHomeNodeCell nodeId={id} accountId={undefined as never}/></Gw2AccountBodyCells>}
        </HomeNode.DynamicColumns>
      </HomeNode.Table>


      <Headline id="cats" actions={<ColumnSelect table={HomeCats}/>}><Trans id="homestead.cats"/></Headline>
      <p><Trans id="homestead.cats.description"/></p>

      <HomeCats.Table>
        <HomeCats.Column id="id" title="Id" align="right" small hidden>{({ id }) => id}</HomeCats.Column>
        <HomeCats.Column id="name" title="Cat" sortBy="name">{({ name, icon }) => <FlexRow><MaybeRenderIcon src={icon}/> {name}</FlexRow>}</HomeCats.Column>
        <HomeCats.Column id="desc" title="Description" sortBy="description">{({ description }) => <CatDescription description={description}/>}</HomeCats.Column>
        <HomeCats.DynamicColumns headers={<Gw2AccountHeaderCells requiredScopes={requiredScopes} small/>}>
          {({ id }) => <Gw2AccountBodyCells requiredScopes={requiredScopes}><AccountHomeCatCell catId={id} accountId={undefined as never}/></Gw2AccountBodyCells>}
        </HomeCats.DynamicColumns>
      </HomeCats.Table>

      <DecorationTableProvider categories={decorationFilterDings}>
        <Headline id="decorations" actions={[<DecorationTableFilter key="filter" totalCount={decorations.length}/>, <ColumnSelect key="columns" table={Decorations}/>]}><Trans id="homestead.decorations"/></Headline>
        <p><Trans id="homestead.decorations.description"/></p>

        <Decorations.Table rowFilter={DecorationRowFilter}>
          <Decorations.Column id="id" title="Id" align="right" small hidden>{({ id }) => id}</Decorations.Column>
          <Decorations.Column id="name" title="Decoration" sortBy={(decoration) => decoration[`name_${language}`]}>
            {({ icon, ...decoration }) => (
              <FlexRow>{icon ? <EntityIcon icon={icon} size={32}/> : <EntityIconMissing size={32}/>} {decoration[`name_${language}`]}</FlexRow>
            )}
          </Decorations.Column>
          <Decorations.Column id="categories" title="Categories">
            {({ categories }) => categories.map((category) => localizedName(category, language)).join(', ')}
          </Decorations.Column>
          <Decorations.Column id="maxCount" title="Max Count" sortBy="maxCount" align="right">{({ maxCount }) => <FormatNumber value={maxCount}/>}</Decorations.Column>
          <Decorations.DynamicColumns headers={<Gw2AccountHeaderCells requiredScopes={requiredScopes} small/>}>
            {({ id }) => <Gw2AccountBodyCells requiredScopes={requiredScopes}><AccountHomesteadDecorationCell decorationId={id} accountId={undefined as never}/></Gw2AccountBodyCells>}
          </Decorations.DynamicColumns>
        </Decorations.Table>
      </DecorationTableProvider>

      <Headline id="glyphs"><Trans id="homestead.glyphs"/></Headline>
      <p><Trans id="homestead.glyphs.description"/></p>
      <Glyphs.Table>
        <Glyphs.Column id="name" title="Glyph" sortBy={({ item }) => item ? localizedName(item, language) : ''}>{({ item, itemIdRaw }) => item ? <ItemLink item={item}/> : <UnknownItem id={itemIdRaw}/>}</Glyphs.Column>
        <Glyphs.DynamicColumns headers={<Gw2AccountHeaderCells requiredScopes={requiredScopes} small colSpan={3}/>}>
          {({ id }) => <Gw2AccountBodyCells requiredScopes={requiredScopes}><AccountHomesteadGlyphsCell glyphIdPrefix={id.split('_')[0]} accountId={undefined as never} slotTranslations={glyphSlotTranslations}/></Gw2AccountBodyCells>}
        </Glyphs.DynamicColumns>
      </Glyphs.Table>

      <PageView page="homestead"/>
    </HeroLayout>
  );
}

export const metadata = {
  title: 'Homestead'
};

const MaybeRenderIcon: FC<{ src: string }> = ({ src }) => {
  const icon = parseIcon(src);

  return icon
    ? (<EntityIcon icon={icon} size={32}/>)
    : (<img src={src} width={32} height={32} alt="" style={{ borderRadius: 2 }}/>);
};


const CatDescription: FC<{ description: string }> = ({ description }) => {
  const cleaned = description
    // remove <strong> and </strong> from the description
    .replaceAll(/<\/?strong>/g, '')
    // remove &nbsp; and &thinsp; from description
    .replaceAll(/(\u00A0|\u2009)+/g, ' ');

  return (
    <p style={{ color: 'var(--color-text-muted' }}>{cleaned}</p>
  );
};
