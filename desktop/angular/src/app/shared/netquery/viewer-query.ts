import { Condition, Database, ExpertiseLevel, Netquery, OrderBy, Query } from "@safing/portmaster-api";
import { mergeConditions } from "./utils";

/** The number of connections shown per page in the netquery viewer. */
export const viewerPageSize = 25;

/** The interval (in seconds) used for the bandwidth chart of the netquery viewer. */
export const viewerBandwidthInterval = 60;

export interface ViewerQueryOptions {
  query: Condition;
  mergeFilter: Condition | null;
  databases: Database[];
  select?: Query['select'];
  textSearch?: Query['textSearch'];
  groupByKeys?: string[];
  orderByKeys?: string[];
}

/**
 * Builds the query of the netquery viewer. Both the viewer and the prefetcher
 * use this so their requests share the same cache entries.
 */
export function buildViewerQuery(opts: ViewerQueryOptions): Query {
  let orderBy: string[] | OrderBy[] = opts.orderByKeys || [];
  if (orderBy.length === 0) {
    orderBy = [
      {
        field: 'started',
        desc: true,
      },
      {
        field: 'ended',
        desc: true,
      }
    ]
  }

  return {
    select: opts.select,
    query: mergeConditions(opts.query, opts.mergeFilter || {}),
    groupBy: opts.groupByKeys || [],
    orderBy: orderBy,
    textSearch: opts.textSearch,
    databases: opts.databases,
  }
}

/** Returns the conditions the viewer always applies for the given expertise level. */
export function viewerBaseCondition(expertiseLevel: string): Condition {
  if (expertiseLevel === ExpertiseLevel.Developer) {
    return {};
  }

  return {
    internal: {
      $eq: false,
    },
  };
}

/** Returns the batch request used to load the result counts of the viewer. */
export function viewerCountsBatch(query: Query) {
  return {
    totalCount: {
      ...query,
      select: { $count: { field: '*', as: 'totalCount' } },
    },

    totalConnCount: {
      ...query,
      select: {
        $count: { field: '*', as: 'totalConnCount' }
      },
    }
  } satisfies Record<string, Query>;
}

/**
 * Loads everything the netquery viewer requests in its default state into
 * the cache, so opening it renders immediately.
 */
export function prefetchViewer(netquery: Netquery, mergeFilter: Condition, expertiseLevel: string): Promise<unknown> {
  const query = buildViewerQuery({
    query: viewerBaseCondition(expertiseLevel),
    mergeFilter,
    databases: [Database.Live],
  });

  return Promise.all([
    netquery.prefetchBatch(viewerCountsBatch(query)),
    netquery.prefetchQuery({ ...query, page: 0, pageSize: viewerPageSize }),
    netquery.prefetchActiveConnectionChart(query.query!),
    netquery.prefetchBandwidthChart(query.query!, [], viewerBandwidthInterval),
  ]);
}

/** Loads everything the app view needs for the given profile into the cache. */
export function prefetchAppView(netquery: Netquery, profileKey: string, expertiseLevel: string): Promise<unknown> {
  return Promise.all([
    netquery.prefetchProfileStats({ profile: profileKey }),
    netquery.prefetchProfileHistorySummary(profileKey),
    prefetchViewer(netquery, { profile: profileKey }, expertiseLevel),
  ]);
}
