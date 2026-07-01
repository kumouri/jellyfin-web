import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import { getPersonsApi } from '@jellyfin/sdk/lib/utils/api/persons-api';
import { useQuery } from '@tanstack/react-query';
import React, { type ChangeEvent, type FC, useCallback, useState } from 'react';
import { useDebounceValue } from 'usehooks-ts';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import Cards from 'components/cardbuilder/Card/Cards';
import { CardShape } from 'components/cardbuilder/utils/shape';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import type { ItemDto } from 'types/base/models/item-dto';

/*
 * Browse people (persons) as a card grid, filterable by name and by tag. The tag list comes from
 * the /Persons/Tags endpoint; selecting one filters via the /Persons `tags` param.
 */
const People: FC = () => {
    const { api, user } = useApi();
    const userId = user?.Id;

    const [nameInput, setNameInput] = useState('');
    const [tag, setTag] = useState('');
    const [debouncedName] = useDebounceValue(nameInput, 400);

    const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value), []);
    const onTagChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => setTag(e.target.value), []);

    const { data: tags = [] } = useQuery({
        queryKey: ['PersonTags'],
        queryFn: async () => {
            const apiClient = ServerConnections.currentApiClient();
            if (!apiClient) {
                return [];
            }

            return await apiClient.getJSON(apiClient.getUrl('Persons/Tags')) as string[];
        },
        enabled: !!api
    });

    const { data: people, isPending } = useQuery({
        queryKey: ['PeopleBrowse', debouncedName, tag, userId],
        queryFn: async ({ signal }) => {
            const response = await getPersonsApi(api!).getPersons(
                {
                    userId,
                    searchTerm: debouncedName || undefined,
                    excludePersonTypes: [PersonKind.Artist, PersonKind.AlbumArtist],
                    fields: [ItemFields.PrimaryImageAspectRatio],
                    limit: 300,
                    enableImages: true
                },
                { params: tag ? { tags: tag } : undefined, signal }
            );
            return (response.data.Items ?? []) as BaseItemDto[];
        },
        enabled: !!api && !!userId
    });

    let content;
    if (isPending) {
        content = <Loading />;
    } else if (!people?.length) {
        content = <div className='noItemsMessage centerMessage'>{globalize.translate('MessageNothingHere')}</div>;
    } else {
        content = (
            <div className='itemsContainer vertical-wrap padded-left padded-right' style={{ marginTop: '1.5em' }}>
                <Cards
                    items={people as unknown as ItemDto[]}
                    cardOptions={{
                        shape: CardShape.Portrait,
                        showTitle: true,
                        centerText: true,
                        coverImage: true
                    }}
                />
            </div>
        );
    }

    return (
        <Page
            id='peoplePage'
            title={globalize.translate('People')}
            className='mainAnimatedPage libraryPage allLibraryPage noSecondaryNavPage'
        >
            <div
                className='padded-left padded-right flex align-items-center'
                style={{ gap: '1em', marginTop: '1.5em', flexWrap: 'wrap' }}
            >
                <input
                    is='emby-input'
                    type='text'
                    value={nameInput}
                    placeholder={globalize.translate('Search')}
                    onChange={onNameChange}
                    style={{ maxWidth: '20em' }}
                />
                <select is='emby-select' value={tag} onChange={onTagChange}>
                    <option value=''>{globalize.translate('AllTags')}</option>
                    {tags.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            {content}
        </Page>
    );
};

export default People;
