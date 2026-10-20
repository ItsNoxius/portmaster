import { QueryClient, QueryKey, QueryObserver, QueryObserverResult } from '@tanstack/query-core';
import { Observable, firstValueFrom } from 'rxjs';

/**
 * Shared TanStack query client used to cache and de-duplicate requests
 * to the Portmaster API.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Connection data changes constantly, so cached results are
      // considered stale quickly and revalidated in the background.
      staleTime: 3_000,
      // Keep unused results around so revisiting a view renders instantly.
      gcTime: 10 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

/**
 * Returns an observable that follows stale-while-revalidate semantics:
 * cached data (even if stale) is emitted synchronously on subscribe, a
 * background refetch is started if the data is stale and the fresh result
 * is emitted once it arrives. The observable completes once no fetch is
 * in flight, so it can still be used with operators like forkJoin.
 */
export function cachedQuery<T>(queryKey: QueryKey, fetcher: () => Observable<T>): Observable<T> {
  return new Observable<T>(subscriber => {
    const observer = new QueryObserver<T, Error, T, T, QueryKey>(queryClient, {
      queryKey,
      queryFn: () => firstValueFrom(fetcher()),
    });

    let lastEmitted = 0;
    const handle = (result: QueryObserverResult<T, Error>) => {
      if (result.status === 'success' && result.dataUpdatedAt !== lastEmitted) {
        lastEmitted = result.dataUpdatedAt;
        subscriber.next(result.data);
      }

      if (result.fetchStatus !== 'idle') {
        return;
      }

      if (result.status === 'error') {
        subscriber.error(result.error);
      } else if (result.status === 'success') {
        subscriber.complete();
      }
    };

    const unsubscribe = observer.subscribe(handle);
    // Listeners are notified asynchronously, so emit the current
    // (possibly cached) result right away.
    handle(observer.getCurrentResult());

    return unsubscribe;
  });
}

/** Fetches the query into the cache unless fresh data is already present. */
export function prefetchQuery<T>(queryKey: QueryKey, fetcher: () => Observable<T>): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: () => firstValueFrom(fetcher()),
  });
}
