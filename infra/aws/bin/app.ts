import { App } from "aws-cdk-lib"
import { NotificationsStack } from "../lib/notifications-stack"

const app = new App()

function context(name: string): string {
  const value = String(app.node.tryGetContext(name) ?? "").trim()
  if (!value) {
    throw new Error(`Missing CDK context "${name}". Pass -c ${name}=… or set it in cdk.json.`)
  }
  return value
}

new NotificationsStack(app, "OpenSpotNotifications", {
  env: { region: context("region"), account: process.env.CDK_DEFAULT_ACCOUNT },
  sendingDomain: context("sendingDomain"),
  fromAddress: context("fromAddress"),
  appUrl: context("appUrl"),
  replyTo: String(app.node.tryGetContext("replyTo") ?? "").trim() || undefined,
  alertEmail: context("alertEmail"),
  monthlyBudgetUsd: Number(app.node.tryGetContext("monthlyBudgetUsd") ?? 1),
  description: "OpenSpot League email notifications: SQS FIFO → Lambda → SES, 15-min tick (docs/notifications.md)",
})
