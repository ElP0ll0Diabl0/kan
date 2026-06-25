import { t } from "@lingui/core/macro";
import { useForm } from "react-hook-form";

import Button from "~/components/Button";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

interface FormValues {
  name: string;
  department: string;
  title: string;
}

const inputClasses =
  "w-full rounded-lg border-0 bg-light-50 px-3 py-2 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500";

const labelClasses = "mb-1 block text-xs text-light-900 dark:text-dark-900";

export function MemberEditForm({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string | null; department: string | null; title: string | null };
}) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();

  const { register, handleSubmit } = useForm<FormValues>({
    values: {
      name: initial.name ?? "",
      department: initial.department ?? "",
      title: initial.title ?? "",
    },
  });

  const updateProfile = api.admin.updateUserProfile.useMutation({
    onSuccess: async () => {
      await utils.admin.getUser.invalidate({ userId });
      showPopup({
        header: t`Profile updated`,
        message: t`The user's profile has been updated.`,
        icon: "success",
      });
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to update profile`,
        message: error.message,
        icon: "error",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    const name = values.name.trim();
    updateProfile.mutate({
      userId,
      name: name || undefined,
      department: values.department.trim() || null,
      title: values.title.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50"
    >
      <h4 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
        {t`Profile`}
      </h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className={labelClasses}>
            {t`Name`}
          </label>
          <input
            id="name"
            type="text"
            {...register("name")}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="department" className={labelClasses}>
            {t`Department`}
          </label>
          <input
            id="department"
            type="text"
            {...register("department")}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="title" className={labelClasses}>
            {t`Title`}
          </label>
          <input
            id="title"
            type="text"
            {...register("title")}
            className={inputClasses}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" isLoading={updateProfile.isPending}>
          {t`Save changes`}
        </Button>
      </div>
    </form>
  );
}
