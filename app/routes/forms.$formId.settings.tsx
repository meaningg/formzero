import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/forms.$formId.settings";
import { data } from "react-router";
import { Mail, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ResultButton } from "~/components/result-button";
import { requireAuth } from "~/lib/require-auth.server";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Settings | FormZero" },
    {
      name: "description",
      content: "Configure notification settings for this form",
    },
  ];
};

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB;
  await requireAuth(request, database);

  const form = await database
    .prepare("SELECT id, name, notification_email FROM forms WHERE id = ?")
    .bind(params.formId)
    .first<{ id: string; name: string; notification_email: string | null }>();

  if (!form) {
    throw data({ error: "Form not found" }, { status: 404 });
  }

  const globalSettings = await database
    .prepare("SELECT notification_email FROM settings WHERE id = 'global'")
    .first<{ notification_email: string | null }>();

  return data({
    form,
    globalNotificationEmail: globalSettings?.notification_email ?? null,
  });
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB;
  await requireAuth(request, database);

  if (request.method !== "POST") {
    return data(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const formData = await request.formData();
    const notification_email =
      (formData.get("notification_email") as string | null) ?? "";

    await database
      .prepare(
        "UPDATE forms SET notification_email = ?, updated_at = ? WHERE id = ?",
      )
      .bind(notification_email.trim() || null, Date.now(), params.formId)
      .run();

    return data({ success: true });
  } catch (error) {
    console.error("Error saving form notification settings:", error);
    return data(
      { success: false, error: "Failed to save settings" },
      { status: 500 },
    );
  }
}

export default function FormSettings() {
  const { form, globalNotificationEmail } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [email, setEmail] = useState(form.notification_email ?? "");

  useEffect(() => {
    setEmail(form.notification_email ?? "");
  }, [form.notification_email]);

  const isSaving = fetcher.state === "submitting";
  const isSaved = fetcher.state === "idle" && fetcher.data?.success === true;

  const effectiveEmail = email.trim() || globalNotificationEmail;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Notification Email</CardTitle>
          <CardDescription>
            Set where new submissions for <strong>{form.name}</strong> should be
            sent. Leave blank to use the global notification email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fetcher.Form method="post" className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="notification_email"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Recipient Email
              </Label>
              <Input
                id="notification_email"
                name="notification_email"
                type="email"
                placeholder={globalNotificationEmail ?? "you@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Submissions will be forwarded to this address. Leave empty to
                use the global setting.
              </p>
            </div>

            {!email.trim() && globalNotificationEmail && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 shrink-0" />
                <span>
                  Using global email:{" "}
                  <strong className="text-foreground">
                    {globalNotificationEmail}
                  </strong>
                </span>
              </div>
            )}

            {!email.trim() && !globalNotificationEmail && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <Mail className="h-4 w-4 shrink-0" />
                <span>
                  No email configured. Set one above or configure global SMTP
                  settings via the sidebar.
                </span>
              </div>
            )}

            {fetcher.data?.error && (
              <p className="text-sm text-destructive">{fetcher.data.error}</p>
            )}

            <ResultButton
              type="submit"
              isSubmitting={isSaving}
              isSuccess={isSaved}
              loadingText="Saving..."
              successText="Saved!"
            >
              Save
            </ResultButton>
          </fetcher.Form>
        </CardContent>
      </Card>
    </div>
  );
}
