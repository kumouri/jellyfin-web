import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { getSearchApi } from '@jellyfin/sdk/lib/utils/api/search-api';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { useQuery } from '@tanstack/react-query';
import { CardShape } from 'components/cardbuilder/utils/shape';
import { CardOptions } from 'types/cardOptions';
import { useApi } from 'hooks/useApi';
import { Section } from '../types';
import { addSection, getCardOptionsFromType, getItemTypesFromCollectionType, getTitleFromType, sortSections } from '../utils/search';

function getSectionForType(type: BaseItemKind): { title: string, options: CardOptions } {
    switch (type) {
        case BaseItemKind.Person:
            return { title: 'People', options: { coverImage: true } };
        case BaseItemKind.MusicArtist:
            return { title: 'Artists', options: { coverImage: true } };
        case BaseItemKind.Studio:
            return { title: 'Studios', options: { shape: CardShape.SquareOverflow } };
        default:
            return { title: getTitleFromType(type), options: getCardOptionsFromType(type) };
    }
}

/**
 * Regex search runs through the /Search/Hints endpoint (the only search path that supports
 * regex matching server-side), then fetches the matched items in full so they render with the
 * normal card builder. The `isRegex` flag is passed via axios `params` because the generated
 * SDK type does not yet include it.
 */
export const useRegexSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string,
    ignoreCase = true
) => {
    const { api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['Search', 'Regex', collectionType, parentId, searchTerm, ignoreCase],
        queryFn: async ({ signal }) => {
            const itemTypes = getItemTypesFromCollectionType(collectionType);

            const hintsResponse = await getSearchApi(api!).getSearchHints(
                {
                    searchTerm: searchTerm!,
                    userId,
                    parentId,
                    includeItemTypes: collectionType ? itemTypes : undefined,
                    limit: 800
                },
                { params: { isRegex: true, regexIgnoreCase: ignoreCase }, signal }
            );

            const ids = (hintsResponse.data.SearchHints ?? [])
                .map(hint => hint.Id)
                .filter((id): id is string => Boolean(id));

            if (ids.length === 0) {
                return [] as Section[];
            }

            const itemsResponse = await getItemsApi(api!).getItems(
                {
                    ids,
                    userId,
                    fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.MediaSourceCount],
                    enableTotalRecordCount: false
                },
                { signal }
            );

            const grouped = new Map<BaseItemKind, BaseItemDto[]>();
            for (const item of itemsResponse.data.Items ?? []) {
                if (!item.Type) {
                    continue;
                }

                const list = grouped.get(item.Type) ?? [];
                list.push(item);
                grouped.set(item.Type, list);
            }

            const sections: Section[] = [];
            for (const [type, items] of grouped) {
                const { title, options } = getSectionForType(type);
                if (title) {
                    addSection(sections, title, items, options);
                }
            }

            return sortSections(sections);
        },
        enabled: !!api && !!userId && !!searchTerm
    });
};
