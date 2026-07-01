import React, { type FC } from 'react';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import Loading from 'components/loading/LoadingComponent';
import globalize from 'lib/globalize';
import { CardShape } from 'components/cardbuilder/utils/shape';
import SearchResultsRow from './SearchResultsRow';
import { Section } from '../types';
import { useRegexSearch } from '../api/useRegexSearch';

interface RegexSearchResultsProps {
    parentId?: string;
    collectionType?: CollectionType;
    query?: string;
    ignoreCase?: boolean;
}

/*
 * React component to display regex search result rows. Backed by the /Search/Hints endpoint in
 * regex mode, kept separate from the normal SearchResults so the standard fast-path search is
 * untouched.
 */
const RegexSearchResults: FC<RegexSearchResultsProps> = ({
    parentId,
    collectionType,
    query,
    ignoreCase = true
}) => {
    const { data, isPending, isError } = useRegexSearch(parentId, collectionType, query?.trim(), ignoreCase);

    if (isPending) return <Loading />;

    if (isError) {
        return (
            <div className='noItemsMessage centerMessage'>
                {globalize.translate('InvalidRegex')}
            </div>
        );
    }

    if (!data?.length) {
        return (
            <div className='noItemsMessage centerMessage'>
                {globalize.translate('SearchResultsEmpty', query)}
            </div>
        );
    }

    const renderSection = (section: Section, index: number) => {
        return (
            <SearchResultsRow
                key={`${section.title}-${index}`}
                title={globalize.translate(section.title)}
                items={section.items}
                cardOptions={{
                    shape: CardShape.AutoOverflow,
                    scalable: true,
                    showTitle: true,
                    overlayText: false,
                    centerText: true,
                    allowBottomPadding: false,
                    ...section.cardOptions
                }}
            />
        );
    };

    return (
        <div className={'searchResults padded-top padded-bottom-page'}>
            {data.map((section, index) => renderSection(section, index))}
        </div>
    );
};

export default RegexSearchResults;
