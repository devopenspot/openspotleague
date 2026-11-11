/**
 * OpenSpot League email notifications (docs/notifications.md).
 *
 *   Worker ──SendMessage──▶ SQS FIFO ──▶ email-sender λ ──▶ Resend (free plan)
 *                              │ 5 tries                     │ bounce/complaint webhook
 *                              ▼                             ▼
 *                             DLQ ──▶ alarm ──▶ SNS ──▶ admin email
 *                                     resend-events λ (Function URL) ──▶ Worker
 *   EventBridge Scheduler (15 min) ──▶ tick λ ──▶ Worker /api/internal/notifications/tick
 *
 * Strictly free: everything here sits in the AWS always-free tier at League
 * scale (docs/notifications.md#cost), and email goes through Resend's free
 * plan, which refuses over quota instead of billing. SES is not used: it has
 * no free tier for this account. The idempotency table is provisioned, not
 * on-demand, for the same reason: 25 provisioned units are always free.
 * The zero-cost guard: any actual charge (credits not counted) makes AWS
 * Budgets attach a deny-all policy to every identity of this stack, which
 * stops it until someone removes the policy by hand.
 * Secrets are not in this template: the internal HMAC secret, the Resend API
 * key and the Resend webhook secret are SSM SecureStrings created by hand,
 * and the Worker's access key is created by hand for `osl-worker-notify`.
 */

import * as path from "node:path"
import { fileURLToPath } from "node:url"
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib"
import * as budgets from "aws-cdk-lib/aws-budgets"
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch"
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources"
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as scheduler from "aws-cdk-lib/aws-scheduler"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import * as sqs from "aws-cdk-lib/aws-sqs"
import type { Construct } from "constructs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const INFRA_ROOT = path.resolve(HERE, "..")
const REPO_ROOT = path.resolve(INFRA_ROOT, "../..")

export const INTERNAL_SECRET_PARAM = "/openspot/notifications/internal-secret"
export const RESEND_API_KEY_PARAM = "/openspot/notifications/resend-api-key"
export const RESEND_WEBHOOK_SECRET_PARAM = "/openspot/notifications/resend-webhook-secret"

export interface NotificationsStackProps extends StackProps {
  /** `OpenSpot League <no-reply@mail.openspotleague.com>`, on a domain verified in Resend. */
  fromAddress: string
  /** Public Worker origin the Lambdas call back. */
  appUrl: string
  /** Optional inbox for replies; without it a reply to `fromAddress` bounces. */
  replyTo?: string
  /** Receives the alarms, the budget alert and the zero-cost guard notice. */
  alertEmail: string
  monthlyBudgetUsd: number
}

export class NotificationsStack extends Stack {
  constructor(scope: Construct, id: string, props: NotificationsStackProps) {
    super(scope, id, props)

    // ---------- queue ----------
    const dlq = new sqs.Queue(this, "EmailDlq", {
      queueName: "osl-notify-email-dlq.fifo",
      fifo: true,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    })
    const queue = new sqs.Queue(this, "EmailQueue", {
      queueName: "osl-notify-email.fifo",
      fifo: true,
      contentBasedDeduplication: false,
      // 6× the sender timeout, per the Lambda + SQS guidance.
      visibilityTimeout: Duration.seconds(180),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
    })

    // ---------- idempotency ----------
    const idempotency = new dynamodb.Table(this, "EmailIdempotency", {
      tableName: "osl-notify-email-idempotency",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      // Each send is two small writes. Five units plus DynamoDB's burst
      // allowance cover a few hundred emails at once; the SDK retries beyond.
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      timeToLiveAttribute: "expiration",
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // ---------- functions ----------
    const parameterArn = (name: string) =>
      Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: name.replace(/^\//, "") })
    const readParameters = (...names: string[]) =>
      new iam.PolicyStatement({ actions: ["ssm:GetParameter"], resources: names.map(parameterArn) })
    const readSecret = readParameters(INTERNAL_SECRET_PARAM)
    const common: Omit<nodejs.NodejsFunctionProps, "entry"> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(INFRA_ROOT, "pnpm-lock.yaml"),
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: "node22",
        minify: true,
        sourceMap: true,
        // AWS SDK v3 ships in the Node 22 runtime.
        externalModules: ["@aws-sdk/*"],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        APP_URL: props.appUrl,
        INTERNAL_SECRET_PARAM,
        NODE_OPTIONS: "--enable-source-maps",
      },
    }
    const logGroup = (name: string) =>
      new logs.LogGroup(this, `${name}Logs`, {
        logGroupName: `/aws/lambda/osl-notify-${name}`,
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      })

    const sender = new nodejs.NodejsFunction(this, "EmailSender", {
      ...common,
      functionName: "osl-notify-email-sender",
      entry: path.join(INFRA_ROOT, "lambdas/email-sender.ts"),
      logGroup: logGroup("email-sender"),
      environment: {
        ...common.environment,
        FROM_ADDRESS: props.fromAddress,
        ...(props.replyTo ? { REPLY_TO: props.replyTo } : {}),
        IDEMPOTENCY_TABLE: idempotency.tableName,
        RESEND_API_KEY_PARAM,
      },
    })
    sender.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
        // Minimum allowed; keeps SES under its sending rate.
        maxConcurrency: 2,
      }),
    )
    idempotency.grantReadWriteData(sender)
    sender.addToRolePolicy(readParameters(INTERNAL_SECRET_PARAM, RESEND_API_KEY_PARAM))

    const tick = new nodejs.NodejsFunction(this, "Tick", {
      ...common,
      functionName: "osl-notify-tick",
      entry: path.join(INFRA_ROOT, "lambdas/tick.ts"),
      timeout: Duration.seconds(60),
      logGroup: logGroup("tick"),
    })
    tick.addToRolePolicy(readSecret)

    // Resend bounce / complaint webhook. A Function URL is free and sits
    // outside Cloudflare, so Bot Fight Mode never blocks Resend's requests.
    // The Svix signature is checked in the function.
    const resendEvents = new nodejs.NodejsFunction(this, "ResendEvents", {
      ...common,
      functionName: "osl-notify-resend-events",
      entry: path.join(INFRA_ROOT, "lambdas/resend-events.ts"),
      logGroup: logGroup("resend-events"),
      environment: { ...common.environment, WEBHOOK_SECRET_PARAM: RESEND_WEBHOOK_SECRET_PARAM },
    })
    resendEvents.addToRolePolicy(readParameters(INTERNAL_SECRET_PARAM, RESEND_WEBHOOK_SECRET_PARAM))
    const webhookUrl = resendEvents.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })

    // ---------- 15-minute tick ----------
    const schedulerRole = new iam.Role(this, "TickSchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    })
    tick.grantInvoke(schedulerRole)
    new scheduler.CfnSchedule(this, "TickSchedule", {
      name: "osl-notify-tick",
      description: "OpenSpot notification tick: reminders, backstop, digests",
      scheduleExpression: "rate(15 minutes)",
      flexibleTimeWindow: { mode: "OFF" },
      target: {
        arn: tick.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: { maximumRetryAttempts: 0 },
      },
    })

    // ---------- Worker producer identity ----------
    const workerUser = new iam.User(this, "WorkerProducer", { userName: "osl-worker-notify" })
    workerUser.addToPolicy(
      new iam.PolicyStatement({ actions: ["sqs:SendMessage"], resources: [queue.queueArn] }),
    )

    // ---------- alarms + budget ----------
    // No `enforceSSL` here: it only takes effect once the topic has its own
    // policy, and adding one would replace the default policy that lets this
    // account's CloudWatch alarms publish. The topic carries alarm text only.
    const alerts = new sns.Topic(this, "Alerts", { topicName: "osl-notify-alerts" })
    alerts.addSubscription(new subscriptions.EmailSubscription(props.alertEmail))
    // Without the tick there are no reminders, digests or retries, and
    // nothing else would say so. One failed run can be a blip; three in an
    // hour (of four) means the Worker is unreachable or the secret is wrong.
    const tickAlarm = new cloudwatch.Alarm(this, "TickFailing", {
      alarmName: "osl-notify-tick-failing",
      alarmDescription: "The 15-minute notification tick is failing (docs/notifications.md runbook).",
      metric: tick.metricErrors({ period: Duration.hours(1), statistic: "Sum" }),
      threshold: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    tickAlarm.addAlarmAction(new cwActions.SnsAction(alerts))
    const dlqAlarm = new cloudwatch.Alarm(this, "DlqNotEmpty", {
      alarmName: "osl-notify-email-dlq-not-empty",
      alarmDescription: "Emails failed 5 times and landed in the DLQ (docs/notifications.md runbook).",
      metric: dlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    dlqAlarm.addAlarmAction(new cwActions.SnsAction(alerts))

    // Zero-cost guard. Credits are excluded, so usage beyond the always-free
    // limits trips it even while credits would pay. Budgets data lags up to
    // about 12 hours. The deny policy stays attached until removed by hand
    // (docs/notifications.md runbook). The first two action budgets are free.
    const zeroCostBudgetName = "osl-notify-zero-cost"
    const zeroCostBudget = new budgets.CfnBudget(this, "ZeroCostBudget", {
      budget: {
        budgetName: zeroCostBudgetName,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 1, unit: "USD" },
        costTypes: { includeCredit: false, includeRefund: false },
      },
    })
    const stopAll = new iam.ManagedPolicy(this, "ZeroCostStop", {
      managedPolicyName: "osl-notify-zero-cost-stop",
      description: "Attached by the osl-notify-zero-cost budget action: stops the notification stack.",
      statements: [new iam.PolicyStatement({ effect: iam.Effect.DENY, actions: ["*"], resources: ["*"] })],
    })
    const guardedRoles = [sender.role!, tick.role!, resendEvents.role!, schedulerRole]
    const guardRole = new iam.Role(this, "ZeroCostGuardRole", {
      assumedBy: new iam.ServicePrincipal("budgets.amazonaws.com"),
    })
    guardRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["iam:AttachRolePolicy", "iam:DetachRolePolicy"],
        resources: guardedRoles.map((role) => role.roleArn),
        conditions: { ArnEquals: { "iam:PolicyARN": stopAll.managedPolicyArn } },
      }),
    )
    guardRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["iam:AttachUserPolicy", "iam:DetachUserPolicy"],
        resources: [workerUser.userArn],
        conditions: { ArnEquals: { "iam:PolicyARN": stopAll.managedPolicyArn } },
      }),
    )
    const guardAction = new budgets.CfnBudgetsAction(this, "ZeroCostGuard", {
      budgetName: zeroCostBudgetName,
      actionType: "APPLY_IAM_POLICY",
      actionThreshold: { type: "ABSOLUTE_VALUE", value: 0.01 },
      notificationType: "ACTUAL",
      approvalModel: "AUTOMATIC",
      executionRoleArn: guardRole.roleArn,
      definition: {
        iamActionDefinition: {
          policyArn: stopAll.managedPolicyArn,
          roles: guardedRoles.map((role) => role.roleName),
          users: [workerUser.userName],
        },
      },
      subscribers: [{ type: "EMAIL", address: props.alertEmail }],
    })
    guardAction.addDependency(zeroCostBudget)

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "osl-notify-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 50,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
      ],
    })

    // ---------- outputs ----------
    new CfnOutput(this, "QueueUrl", {
      value: queue.queueUrl,
      description: "NOTIFY_EMAIL_QUEUE_URL for the Worker",
    })
    new CfnOutput(this, "WorkerUserName", {
      value: workerUser.userName,
      description: "Create an access key for this user: AWS_NOTIFY_ACCESS_KEY_ID / AWS_NOTIFY_SECRET_ACCESS_KEY",
    })
    new CfnOutput(this, "ResendWebhookUrl", {
      value: webhookUrl.url,
      description: "Resend webhook endpoint (events: email.bounced, email.complained)",
    })
  }
}
