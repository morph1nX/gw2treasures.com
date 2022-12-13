import { FC } from 'react';
import { Item, Language } from '@prisma/client';
import { IconSize } from './ItemIcon';
import { Link } from '../Link/Link';
import { WithIcon } from '../../lib/with';

export interface ItemLinkProps {
  item: WithIcon<Item>;
  icon?: IconSize | 'none';
  locale?: Language;
}

export const ItemLink: FC<ItemLinkProps> = ({ item, icon = 32, locale }) => {
  return <Link href={`/item/${item.id}`} item={item} icon={icon} locale={locale}/>;
};
