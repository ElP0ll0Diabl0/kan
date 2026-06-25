import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { HiMiniArrowTopRightOnSquare } from "react-icons/hi2";
import { z } from "zod";

import Button from "~/components/Button";
import FeedbackModal from "~/components/FeedbackModal";
import Input from "~/components/Input";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

const githubTokenSchema = z.object({
  token: z.string().min(1, { message: t`Token is required` }),
});

type GitHubTokenFormValues = z.infer<typeof githubTokenSchema>;

export default function IntegrationsSettings() {
  const { modalContentType, isOpen } = useModal();
  const { showPopup } = usePopup();

  const {
    register,
    handleSubmit,
    formState: { isDirty, errors },
    reset,
  } = useForm<GitHubTokenFormValues>({
    resolver: zodResolver(githubTokenSchema),
    defaultValues: {
      token: "",
    },
  });

  const {
    data: integrations,
    refetch: refetchIntegrations,
    isLoading: integrationsLoading,
  } = api.integration.providers.useQuery();

  const { data: trelloUrl, refetch: refetchTrelloUrl } =
    api.integration.getAuthorizationUrl.useQuery(
      { provider: "trello" },
      {
        enabled:
          !integrationsLoading &&
          !integrations?.some(
            (integration) => integration.provider === "trello",
          ),
        refetchOnWindowFocus: true,
      },
    );

  const { data: githubStatus, refetch: refetchGithubStatus } =
    api.integration.getGitHubStatus.useQuery();

  const { data: teamsStatus, refetch: refetchTeamsStatus } =
    api.integration.getTeamsStatus.useQuery();

  useEffect(() => {
    const handleFocus = () => {
      void refetchIntegrations();
      void refetchGithubStatus();
      void refetchTeamsStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchIntegrations, refetchGithubStatus, refetchTeamsStatus]);

  const { mutateAsync: disconnectTeams } =
    api.integration.disconnectTeams.useMutation({
      onSuccess: () => {
        void refetchTeamsStatus();
        showPopup({
          header: t`Teams disconnected`,
          message: t`Microsoft Teams notifications have been disconnected.`,
          icon: "success",
        });
      },
      onError: () => {
        showPopup({
          header: t`Error disconnecting Teams`,
          message: t`An error occurred while disconnecting Microsoft Teams.`,
          icon: "error",
        });
      },
    });

  const { mutateAsync: disconnectTrello } =
    api.integration.disconnect.useMutation({
      onSuccess: () => {
        void refetchIntegrations();
        void refetchTrelloUrl();
        showPopup({
          header: t`Trello disconnected`,
          message: t`Your Trello account has been disconnected.`,
          icon: "success",
        });
      },
      onError: () => {
        showPopup({
          header: t`Error disconnecting Trello`,
          message: t`An error occurred while disconnecting your Trello account.`,
          icon: "error",
        });
      },
    });

  const { mutateAsync: saveGithubToken, isPending: isSavingGithubToken } =
    api.integration.saveGitHubToken.useMutation({
      onSuccess: () => {
        void refetchGithubStatus();
        reset();
        showPopup({
          header: t`GitHub connected`,
          message: t`Your GitHub account has been connected.`,
          icon: "success",
        });
      },
      onError: () => {
        showPopup({
          header: t`Error connecting GitHub`,
          message: t`An error occurred while connecting your GitHub account.`,
          icon: "error",
        });
      },
    });

  const onSubmitGithubToken = (data: GitHubTokenFormValues) => {
    void saveGithubToken({ token: data.token });
  };

  const { mutateAsync: disconnectGithub } =
    api.integration.disconnectGitHub.useMutation({
      onSuccess: () => {
        void refetchGithubStatus();
        showPopup({
          header: t`GitHub disconnected`,
          message: t`Your GitHub account has been disconnected.`,
          icon: "success",
        });
      },
      onError: () => {
        showPopup({
          header: t`Error disconnecting GitHub`,
          message: t`An error occurred while disconnecting your GitHub account.`,
          icon: "error",
        });
      },
    });

  return (
    <>
      <PageHead title={t`Settings | Integrations`} />

      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Trello`}
        </h2>
        {!integrations?.some(
          (integration) => integration.provider === "trello",
        ) && trelloUrl ? (
          <>
            <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
              {t`Connect your Trello account to import boards.`}
            </p>
            <Button
              variant="primary"
              iconRight={<HiMiniArrowTopRightOnSquare />}
              onClick={() =>
                window.open(
                  trelloUrl.url,
                  "trello_auth",
                  "height=800,width=600",
                )
              }
            >
              {t`Connect Trello`}
            </Button>
          </>
        ) : (
          integrations?.some(
            (integration) => integration.provider === "trello",
          ) && (
            <>
              <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
                {t`Your Trello account is connected.`}
              </p>
              <Button
                variant="secondary"
                onClick={() => disconnectTrello({ provider: "trello" })}
              >
                {t`Disconnect Trello`}
              </Button>
            </>
          )
        )}
      </div>

      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`GitHub`}
        </h2>
        {!githubStatus?.connected ? (
          <>
            <p className="mb-4 text-sm text-neutral-500 dark:text-dark-900">
              {t`Connect your GitHub account to import projects.`}
            </p>
            <form
              onSubmit={handleSubmit(onSubmitGithubToken)}
              className="flex gap-2"
            >
              <div className="mb-4 flex w-full max-w-[325px] items-center gap-2">
                <Input
                  type="password"
                  placeholder="Personal Access Token"
                  {...register("token")}
                  errorMessage={errors.token?.message}
                />
              </div>
              <div>
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={!isDirty || isSavingGithubToken}
                  isLoading={isSavingGithubToken}
                >
                  {t`Connect GitHub`}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
              {t`Your GitHub account is connected.`}
            </p>
            <Button variant="secondary" onClick={() => disconnectGithub()}>
              {t`Disconnect GitHub`}
            </Button>
          </>
        )}
      </div>

      {teamsStatus?.available && (
        <div className="mb-8 border-t border-light-300 dark:border-dark-300">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {t`Microsoft Teams`}
          </h2>
          {!teamsStatus.connected ? (
            <p className="mb-4 text-sm text-neutral-500 dark:text-dark-900">
              {t`Add the Kan app in Microsoft Teams and send the bot a message to start receiving notifications there. You must be signed in to Kan with your Microsoft account.`}
            </p>
          ) : (
            <>
              <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
                {t`Microsoft Teams is connected. You'll receive enabled notifications in Teams.`}
              </p>
              <Button variant="secondary" onClick={() => disconnectTeams()}>
                {t`Disconnect Teams`}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Global modals */}
      <Modal
        modalSize="md"
        isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
      >
        <FeedbackModal />
      </Modal>
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "NEW_WORKSPACE"}
      >
        <NewWorkspaceForm />
      </Modal>
    </>
  );
}
