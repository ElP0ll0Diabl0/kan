import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "@kan/auth/client";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { PageHead } from "~/components/PageHead";
import PatternedBackground from "~/components/PatternedBackground";
import { usePopup } from "~/providers/popup";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, t`Password must be at least 8 characters`),
    confirmPassword: z.string().min(1, t`Please confirm your new password`),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t`Passwords do not match`,
    path: ["confirmPassword"],
  });

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordView() {
  const router = useRouter();
  const { showPopup } = usePopup();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const resetMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!token) throw new Error("missing-token");
      const response = await authClient.resetPassword({
        newPassword: data.newPassword,
        token,
      });
      if (response?.error) {
        throw new Error(response.error.message ?? "reset-failed");
      }
    },
    onSuccess: () => {
      showPopup({
        header: t`Password updated`,
        message: t`Your password has been reset. You can now sign in.`,
        icon: "success",
      });
      router.push("/login");
    },
    onError: () => {
      showPopup({
        header: t`Unable to reset password`,
        message: t`This link may have expired. Please request a new password reset.`,
        icon: "error",
      });
    },
  });

  const isLinkInvalid = !token || !!error;

  return (
    <>
      <PageHead title={t`Reset password | kan.bn`} />
      <main className="h-screen bg-light-100 pt-20 dark:bg-dark-50 sm:pt-0">
        <div className="justify-top flex h-full flex-col items-center px-4 sm:justify-center">
          <div className="z-10 flex w-full flex-col items-center">
            <Link href="/">
              <h1 className="mb-6 text-lg font-bold tracking-tight text-light-1000 dark:text-dark-1000">
                kan.bn
              </h1>
            </Link>
            <p className="mb-10 text-3xl font-bold tracking-tight text-light-1000 dark:text-dark-1000">
              {t`Reset your password`}
            </p>
            <div className="w-full rounded-lg border border-light-500 bg-light-300 px-4 py-10 dark:border-dark-400 dark:bg-dark-200 sm:max-w-md lg:px-10">
              <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                {isLinkInvalid ? (
                  <div className="text-center">
                    <p className="text-sm text-light-1000 dark:text-dark-1000">
                      {t`This password reset link is invalid or has expired.`}
                    </p>
                    <Link
                      href="/login"
                      className="mt-4 inline-block text-sm underline text-light-1000 dark:text-dark-1000"
                    >
                      {t`Back to login`}
                    </Link>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit((data) => resetMutation.mutate(data))}
                  >
                    <div className="space-y-2">
                      <div>
                        <Input
                          id="newPassword"
                          type="password"
                          {...register("newPassword")}
                          placeholder={t`Enter your new password`}
                        />
                        {errors.newPassword && (
                          <p className="mt-2 text-xs text-red-400">
                            {errors.newPassword.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Input
                          id="confirmPassword"
                          type="password"
                          {...register("confirmPassword")}
                          placeholder={t`Confirm your new password`}
                        />
                        {errors.confirmPassword && (
                          <p className="mt-2 text-xs text-red-400">
                            {errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-6">
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={!isValid || resetMutation.isPending}
                        isLoading={resetMutation.isPending}
                        fullWidth
                        size="lg"
                      >
                        {t`Reset password`}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          <PatternedBackground />
        </div>
      </main>
    </>
  );
}
