import { t } from "@lingui/core/macro";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const buttonClasses =
  "flex h-7 w-7 items-center justify-center rounded-md border border-light-300 bg-light-50 text-light-900 enabled:hover:bg-light-200 disabled:opacity-40 dark:border-dark-300 dark:bg-dark-50 dark:text-dark-900 dark:enabled:hover:bg-dark-200";

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: AdminPaginationProps) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = to < total;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-light-900 dark:text-dark-900">
        {t`Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={t`Previous page`}
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
          className={buttonClasses}
        >
          <HiChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t`Next page`}
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          className={buttonClasses}
        >
          <HiChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
