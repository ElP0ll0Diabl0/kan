import { t } from "@lingui/core/macro";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GetCardActivitiesOutput } from "@kan/api/types";
import { authClient } from "@kan/auth/client";

import LoadingSpinner from "~/components/LoadingSpinner";
import { api } from "~/utils/api";
import Comment from "./Comment";

const COMMENTS_PAGE_SIZE = 20;

type CommentActivity = GetCardActivitiesOutput["activities"][number];

const dedupeById = (activities: CommentActivity[]) => {
  const seen = new Set<string>();
  return activities.filter((activity) => {
    if (seen.has(activity.publicId)) return false;
    seen.add(activity.publicId);
    return true;
  });
};

const CommentsList = ({
  cardPublicId,
  isLoading: cardIsLoading,
  isViewOnly,
}: {
  cardPublicId: string;
  isLoading: boolean;
  isViewOnly?: boolean;
}) => {
  const { data: sessionData } = authClient.useSession();
  const utils = api.useUtils();

  const scrollRef = useRef<HTMLDivElement>(null);
  // Comments older than the live "newest" page, loaded by scrolling up.
  const [olderComments, setOlderComments] = useState<CommentActivity[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const didInitialScrollRef = useRef(false);
  const lastNewestIdRef = useRef<string | null>(null);
  // Distance from the bottom captured before prepending older comments, used
  // to keep the viewport anchored on the same comment after the prepend.
  const prependAnchorRef = useRef<number | null>(null);

  // The newest page is a live query so newly added/edited comments appear
  // automatically when the card is invalidated.
  const {
    data: newestPage,
    isFetching: isFetchingNewest,
  } = api.card.getActivities.useQuery(
    {
      cardPublicId,
      limit: COMMENTS_PAGE_SIZE,
      direction: "backward",
      commentsOnly: true,
    },
    { enabled: !!cardPublicId && cardPublicId.length >= 12 },
  );

  const newestComments = useMemo(
    () => newestPage?.activities ?? [],
    [newestPage],
  );

  const comments = useMemo(
    () => dedupeById([...olderComments, ...newestComments]),
    [olderComments, newestComments],
  );

  const hasMore = hasMoreOlder && (newestPage?.hasMore ?? true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Scroll to the newest comment on first load and whenever a new comment is
  // appended (e.g. the user posts one).
  useLayoutEffect(() => {
    if (newestComments.length === 0) return;

    const latestId = newestComments[newestComments.length - 1]?.publicId ?? null;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      lastNewestIdRef.current = latestId;
      scrollToBottom();
      return;
    }

    if (latestId !== lastNewestIdRef.current) {
      lastNewestIdRef.current = latestId;
      scrollToBottom();
    }
  }, [newestComments, scrollToBottom]);

  // After older comments are prepended, restore the scroll position so the
  // viewport stays on the comment the user was reading.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && prependAnchorRef.current !== null) {
      // Restore the same distance from the bottom that existed before the
      // prepend so the user stays on the comment they were reading.
      el.scrollTop = el.scrollHeight - prependAnchorRef.current;
      prependAnchorRef.current = null;
    }
  }, [olderComments]);

  const loadOlder = useCallback(async () => {
    if (isLoadingOlder || !hasMore || comments.length === 0) return;

    const oldest = comments[0];
    if (!oldest) return;

    setIsLoadingOlder(true);
    const el = scrollRef.current;
    prependAnchorRef.current = el ? el.scrollHeight - el.scrollTop : null;

    try {
      const nextPage = await utils.card.getActivities.fetch({
        cardPublicId,
        limit: COMMENTS_PAGE_SIZE,
        direction: "backward",
        commentsOnly: true,
        cursor: new Date(oldest.createdAt).toISOString(),
      });

      setOlderComments((prev) =>
        dedupeById([...nextPage.activities, ...prev]),
      );
      setHasMoreOlder(nextPage.hasMore);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [cardPublicId, comments, hasMore, isLoadingOlder, utils]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop <= 48 && hasMore && !isLoadingOlder) {
      void loadOlder();
    }
  }, [hasMore, isLoadingOlder, loadOlder]);

  // Reset accumulated older comments when navigating between cards.
  useEffect(() => {
    setOlderComments([]);
    setHasMoreOlder(true);
    didInitialScrollRef.current = false;
    lastNewestIdRef.current = null;
  }, [cardPublicId]);

  const isInitialLoading =
    cardIsLoading || (isFetchingNewest && comments.length === 0);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="scrollbar-thumb-rounded-[4px] scrollbar-track-rounded-[4px] flex max-h-[480px] min-h-[160px] flex-col overflow-y-auto pr-1 scrollbar scrollbar-track-light-200 scrollbar-thumb-light-400 dark:scrollbar-track-dark-100 dark:scrollbar-thumb-dark-300"
    >
      {/* Anchor comments to the bottom so the newest are visible first. */}
      <div className="mt-auto flex flex-col space-y-4 pt-4">
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <LoadingSpinner size="sm" />
          </div>
        )}
        {isInitialLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-light-900 dark:text-dark-800">
            {t`No comments yet`}
          </p>
        ) : (
          comments.map((activity) => (
            <Comment
              key={activity.publicId}
              publicId={activity.comment?.publicId}
              cardPublicId={cardPublicId}
              name={activity.user?.name ?? ""}
              email={activity.user?.email ?? ""}
              image={activity.user?.image ?? null}
              isLoading={false}
              createdAt={new Date(activity.createdAt).toISOString()}
              comment={activity.comment?.comment}
              isEdited={!!activity.comment?.updatedAt}
              isAuthor={activity.comment?.createdBy === sessionData?.user.id}
              isViewOnly={!!isViewOnly}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CommentsList;
